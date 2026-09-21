import React from "react";

/**
 * Wraps a node component so it only re-renders when its own data changes.
 *
 * React Flow hands every node component its position (`xPos`/`yPos`) as props,
 * so during a drag it re-renders the node being dragged on every pointer move.
 * The node components here read only `data`, `id` and -- for the evaluator,
 * which serves two node types -- `type`. A position change therefore cannot
 * change what they render, and re-rendering their whole Mantine subtree 60
 * times a second is pure waste: dragging one prompt node spent ~45% of the CPU
 * in synchronous React renders, most of it re-running Mantine's `useStyles` and
 * emotion's style serialization.
 *
 * Comparing `data` by identity is enough because the store never hands out a
 * changed `data` object under its old identity: `setDataPropsForNode` replaces
 * it with a copy (see store.tsx).
 *
 * Node components must keep reading only these props. One that needs `selected`
 * or `dragging` has to compare them here too, or it will not see them change.
 */
export function memoNode<P extends { id: string; data: unknown }>(
  NodeComponent: React.FC<P>,
): React.NamedExoticComponent<P> {
  const Memoized = React.memo(
    NodeComponent,
    (a, b) =>
      a.id === b.id &&
      a.data === b.data &&
      (a as { type?: string }).type === (b as { type?: string }).type,
  );
  Memoized.displayName = `memoNode(${NodeComponent.displayName ?? NodeComponent.name})`;
  return Memoized;
}

export default memoNode;
