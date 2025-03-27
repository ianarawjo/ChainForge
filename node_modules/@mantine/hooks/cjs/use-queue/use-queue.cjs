'use client';
'use strict';

var React = require('react');

function useQueue({ initialValues = [], limit }) {
  const [state, setState] = React.useState({
    state: initialValues.slice(0, limit),
    queue: initialValues.slice(limit)
  });
  const add = (...items) => setState((current) => {
    const results = [...current.state, ...current.queue, ...items];
    return {
      state: results.slice(0, limit),
      queue: results.slice(limit)
    };
  });
  const update = (fn) => setState((current) => {
    const results = fn([...current.state, ...current.queue]);
    return {
      state: results.slice(0, limit),
      queue: results.slice(limit)
    };
  });
  const cleanQueue = () => setState((current) => ({ state: current.state, queue: [] }));
  return {
    state: state.state,
    queue: state.queue,
    add,
    update,
    cleanQueue
  };
}

exports.useQueue = useQueue;
//# sourceMappingURL=use-queue.cjs.map
