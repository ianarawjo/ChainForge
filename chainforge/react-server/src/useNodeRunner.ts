/**
 * Hooks that let a node be run without a click.
 *
 * See backend/runGraph.ts for why this exists. In short: a node's run logic is
 * a closure inside its component, so a chat box -- or a "run all" button --
 * has no way to push a new input through a flow. These hooks publish each
 * node's run function to the registry, wrapped so a driver can await it and
 * learn how it ended.
 */

import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Status } from "./StatusIndicatorComponent";
import { registerNodeRunner } from "./backend/nodeRunnerRegistry";
import { NodeRunner, outcomeFromStatus } from "./backend/runGraph";

type StatusUpdate = Status | ((previous: Status) => Status);

/**
 * `useState` for a node's status, plus a ref that is current immediately.
 *
 * Node run functions report failure by setting an error status rather than
 * throwing, and React state only updates on the next render -- too late for a
 * driver reading it the moment the run function resolves. The ref is written
 * synchronously alongside the state, so it holds the final status by then.
 *
 * Accepts functional updates too, so it drops in for the plain setter.
 */
export function useTrackedStatus(
  initial: Status = Status.NONE,
): [Status, (next: StatusUpdate) => void, MutableRefObject<Status>] {
  const [status, setStatusState] = useState<Status>(initial);
  const statusRef = useRef<Status>(initial);

  const setStatus = useCallback((next: StatusUpdate) => {
    const value = typeof next === "function" ? next(statusRef.current) : next;
    statusRef.current = value;
    setStatusState(value);
  }, []);

  return [status, setStatus, statusRef];
}

/**
 * Publishes how to run this node, for as long as it is mounted.
 *
 * `run` may be a different function on every render; the registry always
 * calls the latest one, so a run never uses settings from an earlier render.
 */
export function useNodeRunner(nodeId: string, run: NodeRunner): void {
  const latest = useRef(run);
  latest.current = run;

  useEffect(() => registerNodeRunner(nodeId, () => latest.current()), [nodeId]);
}

/**
 * Adapts a run function that reports through its status into a NodeRunner.
 *
 * Resets the tracked status to "none" first. Run functions return early
 * without touching status when they refuse to start (no inputs, no methods
 * selected), so without the reset a "ready" left over from the previous run
 * would be read as this run succeeding.
 */
export function runnerFromStatus(
  run: () => unknown,
  statusRef: MutableRefObject<Status>,
): NodeRunner {
  return async () => {
    statusRef.current = Status.NONE;
    await run();
    return outcomeFromStatus(statusRef.current);
  };
}
