'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useReducedMotion } from '../use-reduced-motion/use-reduced-motion.mjs';
import { useWindowEvent } from '../use-window-event/use-window-event.mjs';
import { easeInOutQuad } from './utils/ease-in-out-quad.mjs';
import { getRelativePosition } from './utils/get-relative-position.mjs';
import { getScrollStart } from './utils/get-scroll-start.mjs';
import { setScrollParam } from './utils/set-scroll-param.mjs';

function useScrollIntoView({
  duration = 1250,
  axis = "y",
  onScrollFinish,
  easing = easeInOutQuad,
  offset = 0,
  cancelable = true,
  isList = false
} = {}) {
  const frameID = useRef(0);
  const startTime = useRef(0);
  const shouldStop = useRef(false);
  const scrollableRef = useRef(null);
  const targetRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const cancel = () => {
    if (frameID.current) {
      cancelAnimationFrame(frameID.current);
    }
  };
  const scrollIntoView = useCallback(
    ({ alignment = "start" } = {}) => {
      shouldStop.current = false;
      if (frameID.current) {
        cancel();
      }
      const start = getScrollStart({ parent: scrollableRef.current, axis }) ?? 0;
      const change = getRelativePosition({
        parent: scrollableRef.current,
        target: targetRef.current,
        axis,
        alignment,
        offset,
        isList
      }) - (scrollableRef.current ? 0 : start);
      function animateScroll() {
        if (startTime.current === 0) {
          startTime.current = performance.now();
        }
        const now = performance.now();
        const elapsed = now - startTime.current;
        const t = reducedMotion || duration === 0 ? 1 : elapsed / duration;
        const distance = start + change * easing(t);
        setScrollParam({
          parent: scrollableRef.current,
          axis,
          distance
        });
        if (!shouldStop.current && t < 1) {
          frameID.current = requestAnimationFrame(animateScroll);
        } else {
          typeof onScrollFinish === "function" && onScrollFinish();
          startTime.current = 0;
          frameID.current = 0;
          cancel();
        }
      }
      animateScroll();
    },
    [axis, duration, easing, isList, offset, onScrollFinish, reducedMotion]
  );
  const handleStop = () => {
    if (cancelable) {
      shouldStop.current = true;
    }
  };
  useWindowEvent("wheel", handleStop, {
    passive: true
  });
  useWindowEvent("touchmove", handleStop, {
    passive: true
  });
  useEffect(() => cancel, []);
  return {
    scrollableRef,
    targetRef,
    scrollIntoView,
    cancel
  };
}

export { useScrollIntoView };
//# sourceMappingURL=use-scroll-into-view.mjs.map
