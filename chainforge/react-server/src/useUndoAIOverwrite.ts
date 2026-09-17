import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long after an AI change its updates can keep arriving (some nodes save
 * edits after a short debounce). Changes after this are someone's edits.
 */
const UNDO_SETTLE_MS = 1000;

/**
 * Undo for the most recent AI change that overwrote something (e.g. Replace).
 * Call `remember` just before the change is applied. Undo is offered only
 * while what the AI wrote is still untouched, so it doesn't throw away edits
 * made since.
 * @param current What the AI would overwrite, e.g. the node's items or code.
 * @param restore Puts back what was there before.
 */
export default function useUndoAIOverwrite<T>(
  current: T,
  restore: (before: T) => void,
) {
  const latest = useRef(current);
  latest.current = current;

  const [change, setChange] = useState<{
    before: T;
    beforeKey: string;
    at: number; // when it was applied
    afterKey?: string; // what the AI wrote, once it has shown up
  }>();

  // Only serialized while there's a change to compare against
  const currentKey = change ? JSON.stringify(current) : undefined;
  useEffect(() => {
    if (!change || currentKey === undefined) return;
    if (currentKey === (change.afterKey ?? change.beforeKey)) return;
    if (Date.now() - change.at < UNDO_SETTLE_MS)
      setChange({ ...change, afterKey: currentKey });
    else setChange(undefined); // edited since
  }, [change, currentKey]);

  // If the AI wrote exactly what was there, nothing changed: nothing to undo
  useEffect(() => {
    if (!change || change.afterKey !== undefined) return;
    const timeout = setTimeout(
      () => setChange((c) => (c === change ? undefined : c)),
      UNDO_SETTLE_MS,
    );
    return () => clearTimeout(timeout);
  }, [change]);

  const remember = useCallback(() => {
    setChange({
      before: latest.current,
      beforeKey: JSON.stringify(latest.current),
      at: Date.now(),
    });
  }, []);

  const undo = useCallback(() => {
    if (change?.afterKey === undefined) return;
    setChange(undefined);
    restore(change.before);
  }, [change, restore]);

  return { remember, canUndo: change?.afterKey !== undefined, undo };
}
