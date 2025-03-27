'use client';
import { useEffect } from 'react';

function useWindowEvent(type, listener, options) {
  useEffect(() => {
    window.addEventListener(type, listener, options);
    return () => window.removeEventListener(type, listener, options);
  }, [type, listener]);
}

export { useWindowEvent };
//# sourceMappingURL=use-window-event.mjs.map
