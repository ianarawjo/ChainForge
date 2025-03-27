'use client';
import { useRef, useState, useCallback } from 'react';

function useInViewport() {
  const observer = useRef(null);
  const [inViewport, setInViewport] = useState(false);
  const ref = useCallback((node) => {
    if (typeof IntersectionObserver !== "undefined") {
      if (node && !observer.current) {
        observer.current = new IntersectionObserver(
          (entries) => setInViewport(entries.some((entry) => entry.isIntersecting))
        );
      } else {
        observer.current?.disconnect();
      }
      if (node) {
        observer.current?.observe(node);
      } else {
        setInViewport(false);
      }
    }
  }, []);
  return { ref, inViewport };
}

export { useInViewport };
//# sourceMappingURL=use-in-viewport.mjs.map
