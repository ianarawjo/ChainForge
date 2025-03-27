'use client';
'use strict';

var React = require('react');

function useStateHistory(initialValue) {
  const [state, setState] = React.useState({
    history: [initialValue],
    current: 0
  });
  const set = React.useCallback(
    (val) => setState((currentState) => {
      const nextState = [...currentState.history.slice(0, currentState.current + 1), val];
      return {
        history: nextState,
        current: nextState.length - 1
      };
    }),
    []
  );
  const back = React.useCallback(
    (steps = 1) => setState((currentState) => ({
      history: currentState.history,
      current: Math.max(0, currentState.current - steps)
    })),
    []
  );
  const forward = React.useCallback(
    (steps = 1) => setState((currentState) => ({
      history: currentState.history,
      current: Math.min(currentState.history.length - 1, currentState.current + steps)
    })),
    []
  );
  const reset = React.useCallback(() => {
    setState({ history: [initialValue], current: 0 });
  }, [initialValue]);
  const handlers = React.useMemo(() => ({ back, forward, reset, set }), [back, forward, reset, set]);
  return [state.history[state.current], handlers, state];
}

exports.useStateHistory = useStateHistory;
//# sourceMappingURL=use-state-history.cjs.map
