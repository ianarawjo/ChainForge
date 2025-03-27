'use client';
import { useRef, useCallback, useEffect } from 'react';

function useTimeout(callback, delay, options = { autoInvoke: false }) {
  const timeoutRef = useRef(null);
  const start = useCallback(
    (...callbackParams) => {
      if (!timeoutRef.current) {
        timeoutRef.current = window.setTimeout(() => {
          callback(callbackParams);
          timeoutRef.current = null;
        }, delay);
      }
    },
    [delay]
  );
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (options.autoInvoke) {
      start();
    }
    return clear;
  }, [clear, start]);
  return { start, clear };
}

export { useTimeout };
//# sourceMappingURL=use-timeout.mjs.map
