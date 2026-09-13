/**
 * Tells the ChainForge server, every few minutes, that a page is still open.
 *
 * `chainforge serve --idle-shutdown MINUTES` stops the server once no request
 * has reached it for that long (chainforge/idle_shutdown.py), so a machine
 * left on doesn't keep an unattended ChainForge running. It is off by default,
 * and used by the packager's on-demand Mac app. A page can sit open
 * without making any requests, so it sends this heartbeat to count as in use.
 *
 * Browsers slow timers in background tabs, so the interval is deliberately
 * long and the server's timeout should be several intervals. A heartbeat is
 * also sent whenever the page becomes visible again, such as after the
 * machine wakes.
 */

export const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/** The parts of `document` the heartbeat uses, so tests can supply their own. */
export interface VisibilitySource {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface HeartbeatOptions {
  /** Sends one heartbeat. Failures are ignored: the next one simply tries again. */
  send: () => unknown;
  intervalMs?: number;
  visibility?: VisibilitySource;
}

/** Starts sending heartbeats. Returns a function that stops them. */
export function startServerHeartbeat({
  send,
  intervalMs = HEARTBEAT_INTERVAL_MS,
  visibility = document,
}: HeartbeatOptions): () => void {
  const beat = () => {
    try {
      const result = send();
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      // A server that has stopped cannot be kept alive; nothing to do.
    }
  };
  const onVisibilityChange = () => {
    if (visibility.visibilityState === "visible") beat();
  };

  beat();
  const timer = setInterval(beat, intervalMs);
  visibility.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    clearInterval(timer);
    visibility.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

/**
 * Whether this page's server stops when idle, and so wants heartbeats.
 *
 * Set by the server only when started with --idle-shutdown (see
 * page_globals_script in flask_app.py). An ordinary ChainForge server runs
 * indefinitely, and its pages send nothing.
 */
export function serverStopsWhenIdle(win: object = window): boolean {
  return (
    (win as { __CF_IDLE_SHUTDOWN_MINUTES?: unknown })
      .__CF_IDLE_SHUTDOWN_MINUTES !== undefined
  );
}
