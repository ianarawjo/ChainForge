/**
 * Where nodes publish a way to run themselves without a click.
 *
 * Kept outside the zustand store on purpose. Runners are functions that change
 * every render; putting them in store state would notify every subscriber on
 * each registration and re-render the whole canvas for no visible change.
 * Nothing needs to react to the registry changing -- it is only read at the
 * moment a run starts.
 */

import { NodeRunner } from "./runGraph";

const runners = new Map<string, NodeRunner>();

/**
 * Registers how to run a node. Returns a function that undoes it.
 *
 * The returned cleanup only removes the entry if it is still this runner. In
 * React strict mode an effect mounts, unmounts and mounts again; without that
 * check, the first mount's cleanup would delete the second mount's
 * registration and leave the node silently unrunnable.
 */
export function registerNodeRunner(
  nodeId: string,
  runner: NodeRunner,
): () => void {
  runners.set(nodeId, runner);
  return () => {
    if (runners.get(nodeId) === runner) runners.delete(nodeId);
  };
}

export function getNodeRunner(nodeId: string): NodeRunner | undefined {
  return runners.get(nodeId);
}

export function hasNodeRunner(nodeId: string): boolean {
  return runners.has(nodeId);
}

/** Tests only. */
export function clearNodeRunners(): void {
  runners.clear();
}
