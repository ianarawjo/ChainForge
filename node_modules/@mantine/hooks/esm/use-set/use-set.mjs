'use client';
import { useRef } from 'react';
import { useForceUpdate } from '../use-force-update/use-force-update.mjs';

function useSet(values) {
  const setRef = useRef(new Set(values));
  const forceUpdate = useForceUpdate();
  setRef.current.add = (...args) => {
    const res = Set.prototype.add.apply(setRef.current, args);
    forceUpdate();
    return res;
  };
  setRef.current.clear = (...args) => {
    Set.prototype.clear.apply(setRef.current, args);
    forceUpdate();
  };
  setRef.current.delete = (...args) => {
    const res = Set.prototype.delete.apply(setRef.current, args);
    forceUpdate();
    return res;
  };
  return setRef.current;
}

export { useSet };
//# sourceMappingURL=use-set.mjs.map
