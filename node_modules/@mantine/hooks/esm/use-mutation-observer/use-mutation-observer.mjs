'use client';
import { useRef, useEffect } from 'react';

function useMutationObserver(callback, options, target) {
  const observer = useRef(null);
  const ref = useRef(null);
  useEffect(() => {
    const targetElement = typeof target === "function" ? target() : target;
    if (targetElement || ref.current) {
      observer.current = new MutationObserver(callback);
      observer.current.observe(targetElement || ref.current, options);
    }
    return () => {
      observer.current?.disconnect();
    };
  }, [callback, options]);
  return ref;
}

export { useMutationObserver };
//# sourceMappingURL=use-mutation-observer.mjs.map
