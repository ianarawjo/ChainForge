'use client';
import { useReducer } from 'react';

const reducer = (value) => (value + 1) % 1e6;
function useForceUpdate() {
  const [, update] = useReducer(reducer, 0);
  return update;
}

export { useForceUpdate };
//# sourceMappingURL=use-force-update.mjs.map
