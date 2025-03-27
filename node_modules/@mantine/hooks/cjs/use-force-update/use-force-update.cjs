'use client';
'use strict';

var React = require('react');

const reducer = (value) => (value + 1) % 1e6;
function useForceUpdate() {
  const [, update] = React.useReducer(reducer, 0);
  return update;
}

exports.useForceUpdate = useForceUpdate;
//# sourceMappingURL=use-force-update.cjs.map
