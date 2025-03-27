'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

function useHover() {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);
  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener("mouseenter", onMouseEnter);
      node.addEventListener("mouseleave", onMouseLeave);
      return () => {
        node?.removeEventListener("mouseenter", onMouseEnter);
        node?.removeEventListener("mouseleave", onMouseLeave);
      };
    }
    return void 0;
  }, [ref.current]);
  return { ref, hovered };
}

export { useHover };
//# sourceMappingURL=use-hover.mjs.map
