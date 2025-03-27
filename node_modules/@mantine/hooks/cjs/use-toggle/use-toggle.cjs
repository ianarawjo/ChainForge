'use client';
'use strict';

var React = require('react');

function useToggle(options = [false, true]) {
  const [[option], toggle] = React.useReducer((state, action) => {
    const value = action instanceof Function ? action(state[0]) : action;
    const index = Math.abs(state.indexOf(value));
    return state.slice(index).concat(state.slice(0, index));
  }, options);
  return [option, toggle];
}

exports.useToggle = useToggle;
//# sourceMappingURL=use-toggle.cjs.map
