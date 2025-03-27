'use client';
import { useRef, useEffect } from 'react';

function useDidUpdate(fn, dependencies) {
  const mounted = useRef(false);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  useEffect(() => {
    if (mounted.current) {
      return fn();
    }
    mounted.current = true;
    return void 0;
  }, dependencies);
}

export { useDidUpdate };
//# sourceMappingURL=use-did-update.mjs.map
