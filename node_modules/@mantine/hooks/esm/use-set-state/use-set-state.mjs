'use client';
import { useState, useCallback } from 'react';

function useSetState(initialState) {
  const [state, setState] = useState(initialState);
  const _setState = useCallback(
    (statePartial) => setState((current) => ({
      ...current,
      ...typeof statePartial === "function" ? statePartial(current) : statePartial
    })),
    []
  );
  return [state, _setState];
}

export { useSetState };
//# sourceMappingURL=use-set-state.mjs.map
