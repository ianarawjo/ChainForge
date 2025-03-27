'use client';
import { useState, useCallback } from 'react';

function useModalsStack(modals) {
  const initialState = modals.reduce(
    (acc, modal) => ({ ...acc, [modal]: false }),
    {}
  );
  const [state, setState] = useState(initialState);
  const open = useCallback((modal) => {
    setState((current) => ({ ...current, [modal]: true }));
  }, []);
  const close = useCallback(
    (modal) => setState((current) => ({ ...current, [modal]: false })),
    []
  );
  const toggle = useCallback(
    (modal) => setState((current) => ({ ...current, [modal]: !current[modal] })),
    []
  );
  const closeAll = useCallback(() => setState(initialState), []);
  const register = useCallback(
    (modal) => ({
      opened: state[modal],
      onClose: () => close(modal),
      stackId: modal
    }),
    [state]
  );
  return { state, open, close, closeAll, toggle, register };
}
const useDrawersStack = useModalsStack;

export { useDrawersStack, useModalsStack };
//# sourceMappingURL=use-modals-stack.mjs.map
