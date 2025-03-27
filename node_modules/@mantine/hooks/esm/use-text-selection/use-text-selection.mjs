'use client';
import { useState, useEffect } from 'react';
import { useForceUpdate } from '../use-force-update/use-force-update.mjs';

function useTextSelection() {
  const forceUpdate = useForceUpdate();
  const [selection, setSelection] = useState(null);
  const handleSelectionChange = () => {
    setSelection(document.getSelection());
    forceUpdate();
  };
  useEffect(() => {
    setSelection(document.getSelection());
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);
  return selection;
}

export { useTextSelection };
//# sourceMappingURL=use-text-selection.mjs.map
