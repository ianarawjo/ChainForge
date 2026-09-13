import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import {
  HEARTBEAT_INTERVAL_MS,
  VisibilitySource,
  serverStopsWhenIdle,
  startServerHeartbeat,
} from "../serverHeartbeat";

/** A stand-in for `document`'s visibility state and events. */
function fakeVisibility() {
  const listeners = new Set<() => void>();
  const source: VisibilitySource & {
    set(state: DocumentVisibilityState): void;
    listenerCount(): number;
  } = {
    visibilityState: "visible",
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    set(state) {
      this.visibilityState = state;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
  return source;
}

describe("startServerHeartbeat", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("sends one heartbeat at once, then one every five minutes", () => {
    const send = jest.fn();
    const stop = startServerHeartbeat({ send, visibility: fakeVisibility() });
    expect(send).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
    expect(send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(2 * HEARTBEAT_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(4);
    stop();
  });

  test("the interval is five minutes", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(300000);
  });

  test("sends a heartbeat when the page becomes visible again, not when hidden", () => {
    const send = jest.fn();
    const visibility = fakeVisibility();
    const stop = startServerHeartbeat({ send, visibility });
    send.mockClear();

    visibility.set("hidden");
    expect(send).not.toHaveBeenCalled();
    visibility.set("visible");
    expect(send).toHaveBeenCalledTimes(1);
    stop();
  });

  test("stopping cancels the interval and the visibility listener", () => {
    const send = jest.fn();
    const visibility = fakeVisibility();
    const stop = startServerHeartbeat({ send, visibility });
    stop();
    send.mockClear();

    jest.advanceTimersByTime(10 * HEARTBEAT_INTERVAL_MS);
    visibility.set("visible");
    expect(send).not.toHaveBeenCalled();
    expect(visibility.listenerCount()).toBe(0);
  });

  test("a failed heartbeat does not stop the next ones", async () => {
    let calls = 0;
    const send = jest.fn(() => {
      calls++;
      if (calls === 1) throw new Error("server stopped");
      return Promise.reject(new Error("network error"));
    });
    const stop = startServerHeartbeat({ send, visibility: fakeVisibility() });
    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    await Promise.resolve();
    jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(3);
    stop();
  });
});

describe("serverStopsWhenIdle", () => {
  test("true when the server was started with idle shutdown", () => {
    expect(serverStopsWhenIdle({ __CF_IDLE_SHUTDOWN_MINUTES: 20 })).toBe(true);
  });

  test("false for an ordinary ChainForge server, which wants no heartbeats", () => {
    expect(serverStopsWhenIdle({ __CF_HOSTNAME: "localhost" })).toBe(false);
    expect(serverStopsWhenIdle({})).toBe(false);
  });
});
