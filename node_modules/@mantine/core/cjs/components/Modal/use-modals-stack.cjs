'use client';
'use strict';

var React = require('react');

function useModalsStack(modals) {
  const initialState = modals.reduce(
    (acc, modal) => ({ ...acc, [modal]: false }),
    {}
  );
  const [state, setState] = React.useState(initialState);
  const open = React.useCallback((modal) => {
    setState((current) => ({ ...current, [modal]: true }));
  }, []);
  const close = React.useCallback(
    (modal) => setState((current) => ({ ...current, [modal]: false })),
    []
  );
  const toggle = React.useCallback(
    (modal) => setState((current) => ({ ...current, [modal]: !current[modal] })),
    []
  );
  const closeAll = React.useCallback(() => setState(initialState), []);
  const register = React.useCallback(
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

exports.useDrawersStack = useDrawersStack;
exports.useModalsStack = useModalsStack;
//# sourceMappingURL=use-modals-stack.cjs.map
