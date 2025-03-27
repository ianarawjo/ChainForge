'use client';
import { useRef } from 'react';

function useIsFirstRender() {
  const renderRef = useRef(true);
  if (renderRef.current === true) {
    renderRef.current = false;
    return true;
  }
  return renderRef.current;
}

export { useIsFirstRender };
//# sourceMappingURL=use-is-first-render.mjs.map
