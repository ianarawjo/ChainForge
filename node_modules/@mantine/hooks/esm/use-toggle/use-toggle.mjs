'use client';
import { useReducer } from 'react';

function useToggle(options = [false, true]) {
  const [[option], toggle] = useReducer((state, action) => {
    const value = action instanceof Function ? action(state[0]) : action;
    const index = Math.abs(state.indexOf(value));
    return state.slice(index).concat(state.slice(0, index));
  }, options);
  return [option, toggle];
}

export { useToggle };
//# sourceMappingURL=use-toggle.mjs.map
