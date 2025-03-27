'use client';
import { useEffect, useRef } from 'react';
import { shallowEqual } from '../utils/shallow-equal/shallow-equal.mjs';

function shallowCompare(prevValue, currValue) {
  if (!prevValue || !currValue) {
    return false;
  }
  if (prevValue === currValue) {
    return true;
  }
  if (prevValue.length !== currValue.length) {
    return false;
  }
  for (let i = 0; i < prevValue.length; i += 1) {
    if (!shallowEqual(prevValue[i], currValue[i])) {
      return false;
    }
  }
  return true;
}
function useShallowCompare(dependencies) {
  const ref = useRef([]);
  const updateRef = useRef(0);
  if (!shallowCompare(ref.current, dependencies)) {
    ref.current = dependencies;
    updateRef.current += 1;
  }
  return [updateRef.current];
}
function useShallowEffect(cb, dependencies) {
  useEffect(cb, useShallowCompare(dependencies));
}

export { useShallowEffect };
//# sourceMappingURL=use-shallow-effect.mjs.map
