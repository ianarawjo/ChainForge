'use client';
'use strict';

var React = require('react');

function useSetState(initialState) {
  const [state, setState] = React.useState(initialState);
  const _setState = React.useCallback(
    (statePartial) => setState((current) => ({
      ...current,
      ...typeof statePartial === "function" ? statePartial(current) : statePartial
    })),
    []
  );
  return [state, _setState];
}

exports.useSetState = useSetState;
//# sourceMappingURL=use-set-state.cjs.map
