'use client';
import { useRef, useEffect } from 'react';

function useEventListener(type, listener, options) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener(type, listener, options);
      return () => node?.removeEventListener(type, listener, options);
    }
    return void 0;
  }, [listener, options]);
  return ref;
}

export { useEventListener };
//# sourceMappingURL=use-event-listener.mjs.map
