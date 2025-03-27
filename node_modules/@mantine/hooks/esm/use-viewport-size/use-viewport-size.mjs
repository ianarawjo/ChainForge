'use client';
import { useState, useCallback, useEffect } from 'react';
import { useWindowEvent } from '../use-window-event/use-window-event.mjs';

const eventListerOptions = {
  passive: true
};
function useViewportSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0
  });
  const setSize = useCallback(() => {
    setWindowSize({ width: window.innerWidth || 0, height: window.innerHeight || 0 });
  }, []);
  useWindowEvent("resize", setSize, eventListerOptions);
  useWindowEvent("orientationchange", setSize, eventListerOptions);
  useEffect(setSize, []);
  return windowSize;
}

export { useViewportSize };
//# sourceMappingURL=use-viewport-size.mjs.map
