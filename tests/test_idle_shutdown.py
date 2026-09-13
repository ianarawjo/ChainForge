"""Tests for stopping the server when no ChainForge page is open.

The watchdog is driven with a fake clock, so nothing here sleeps.
"""

import signal
import sys
from unittest.mock import patch

import pytest

from chainforge.idle_shutdown import (
    IdleWatchdog,
    idle_shutdown_message,
    stop_this_server,
)


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


def make_watchdog(clock, timeout=600, suspend_gap=300):
    fired = []
    watchdog = IdleWatchdog(
        timeout,
        on_idle=lambda: fired.append(clock()),
        clock=clock,
        suspend_gap_seconds=suspend_gap,
    )
    return watchdog, fired


def run_for(watchdog, clock, seconds, step=30):
    """Advances the clock in check-interval steps, checking at each."""
    for _ in range(int(seconds // step)):
        clock.advance(step)
        watchdog.check()


class TestIdleWatchdog:

    def test_not_idle_before_the_timeout(self):
        clock = FakeClock()
        watchdog, fired = make_watchdog(clock)
        run_for(watchdog, clock, 570)
        assert fired == []

    def test_fires_once_the_timeout_passes(self):
        clock = FakeClock()
        watchdog, fired = make_watchdog(clock)
        run_for(watchdog, clock, 600)
        assert len(fired) == 1
        run_for(watchdog, clock, 600)
        assert len(fired) == 1, "fires only once"

    def test_activity_restarts_the_idle_period(self):
        clock = FakeClock()
        watchdog, fired = make_watchdog(clock)
        run_for(watchdog, clock, 480)
        watchdog.touch()
        run_for(watchdog, clock, 570)
        assert fired == []
        run_for(watchdog, clock, 60)
        assert len(fired) == 1

    def test_waking_from_sleep_does_not_shut_down_at_once(self):
        # Heartbeats stop while the machine sleeps; waking must not look idle.
        clock = FakeClock()
        watchdog, fired = make_watchdog(clock)
        run_for(watchdog, clock, 60)
        clock.advance(3 * 3600)
        assert watchdog.check() is False
        run_for(watchdog, clock, 570)
        assert fired == []
        run_for(watchdog, clock, 60)
        assert len(fired) == 1

    def test_seconds_idle(self):
        clock = FakeClock()
        watchdog, _ = make_watchdog(clock)
        clock.advance(42)
        assert watchdog.seconds_idle() == pytest.approx(42)
        watchdog.touch()
        assert watchdog.seconds_idle() == 0

    @pytest.mark.parametrize("timeout", [0, -5])
    def test_rejects_a_timeout_that_is_not_positive(self, timeout):
        with pytest.raises(ValueError):
            IdleWatchdog(timeout, on_idle=lambda: None)


def test_stopping_interrupts_the_server_process():
    with patch("chainforge.idle_shutdown.os.kill") as kill, \
         patch("chainforge.idle_shutdown.threading.Timer") as timer:
        stop_this_server("bye")
    kill.assert_called_once()
    assert kill.call_args.args[1] == signal.SIGINT
    assert timer.return_value.daemon is True
    timer.return_value.start.assert_called_once()


def test_the_shutdown_message_names_the_timeout():
    assert "20 minutes" in idle_shutdown_message(20)
    assert "7.5 minutes" in idle_shutdown_message(7.5)
    assert "for 1 minute." in idle_shutdown_message(1)


class TestHeartbeatEndpoint:

    @pytest.fixture
    def flask_app(self):
        import chainforge.flask_app as flask_app
        original = flask_app.IDLE_WATCHDOG
        yield flask_app
        flask_app.IDLE_WATCHDOG = original

    @staticmethod
    def client(flask_app, token=True):
        client = flask_app.app.test_client()
        if token:
            client.environ_base["HTTP_X_CHAINFORGE_TOKEN"] = flask_app.SESSION_TOKEN
        return client

    def test_an_ordinary_server_does_not_ask_pages_for_heartbeats(self, flask_app):
        # Idle shutdown is off by default, so pages must not send heartbeats.
        flask_app.IDLE_WATCHDOG = None
        script = flask_app.page_globals_script()
        assert "__CF_HOSTNAME" in script
        assert "__CF_IDLE_SHUTDOWN_MINUTES" not in script

    def test_a_server_with_idle_shutdown_tells_pages_to_send_heartbeats(self, flask_app):
        clock = FakeClock()
        flask_app.IDLE_WATCHDOG, _ = make_watchdog(clock, timeout=1200)
        assert "window.__CF_IDLE_SHUTDOWN_MINUTES=20;" in flask_app.page_globals_script()

    def test_answers_without_idle_shutdown(self, flask_app):
        flask_app.IDLE_WATCHDOG = None
        resp = self.client(flask_app).post("/api/heartbeat")
        assert resp.status_code == 200
        assert resp.get_json() == {"ok": True, "idleShutdownMinutes": None}

    def test_reports_the_timeout(self, flask_app):
        clock = FakeClock()
        flask_app.IDLE_WATCHDOG, _ = make_watchdog(clock, timeout=1200)
        resp = self.client(flask_app).post("/api/heartbeat")
        assert resp.get_json()["idleShutdownMinutes"] == 20

    def test_any_request_counts_as_activity(self, flask_app):
        clock = FakeClock()
        watchdog, fired = make_watchdog(clock)
        flask_app.IDLE_WATCHDOG = watchdog
        client = self.client(flask_app)

        clock.advance(500)
        client.post("/api/heartbeat")
        assert watchdog.seconds_idle() == 0

        clock.advance(500)
        client.get("/api/flows")
        clock.advance(500)
        watchdog.check()
        assert fired == []

    def test_refused_requests_do_not_count_as_activity(self, flask_app):
        # Another site's page pinging the server must not keep it running.
        clock = FakeClock()
        watchdog, _ = make_watchdog(clock)
        flask_app.IDLE_WATCHDOG = watchdog

        clock.advance(500)
        resp = self.client(flask_app, token=False).post("/api/heartbeat")
        assert resp.status_code == 403
        assert watchdog.seconds_idle() == pytest.approx(500)

    def test_the_page_carries_the_session_token(self, flask_app):
        assert f'window.__CF_SESSION_TOKEN="{flask_app.SESSION_TOKEN}";' in flask_app.page_globals_script()


class TestServeCommand:

    def run_main(self, *argv):
        import chainforge.app as app_module
        with patch.object(app_module, "run_server") as run_server, \
             patch.object(sys, "argv", ["chainforge", "serve", *argv]):
            app_module.main()
        return run_server.call_args.kwargs

    def test_idle_shutdown_is_off_by_default(self):
        assert self.run_main()["idle_shutdown_minutes"] is None

    def test_idle_shutdown_is_passed_to_the_server(self):
        assert self.run_main("--idle-shutdown", "20")["idle_shutdown_minutes"] == 20

    @pytest.mark.parametrize("value", ["0", "-1"])
    def test_rejects_idle_shutdown_that_is_not_positive(self, value):
        with pytest.raises(SystemExit):
            self.run_main("--idle-shutdown", value)
