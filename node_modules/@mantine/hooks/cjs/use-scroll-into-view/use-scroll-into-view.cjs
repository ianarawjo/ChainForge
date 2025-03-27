'use client';
'use strict';

var React = require('react');
var useReducedMotion = require('../use-reduced-motion/use-reduced-motion.cjs');
var useWindowEvent = require('../use-window-event/use-window-event.cjs');
var easeInOutQuad = require('./utils/ease-in-out-quad.cjs');
var getRelativePosition = require('./utils/get-relative-position.cjs');
var getScrollStart = require('./utils/get-scroll-start.cjs');
var setScrollParam = require('./utils/set-scroll-param.cjs');

function useScrollIntoView({
  duration = 1250,
  axis = "y",
  onScrollFinish,
  easing = easeInOutQuad.easeInOutQuad,
  offset = 0,
  cancelable = true,
  isList = false
} = {}) {
  const frameID = React.useRef(0);
  const startTime = React.useRef(0);
  const shouldStop = React.useRef(false);
  const scrollableRef = React.useRef(null);
  const targetRef = React.useRef(null);
  const reducedMotion = useReducedMotion.useReducedMotion();
  const cancel = () => {
    if (frameID.current) {
      cancelAnimationFrame(frameID.current);
    }
  };
  const scrollIntoView = React.useCallback(
    ({ alignment = "start" } = {}) => {
      shouldStop.current = false;
      if (frameID.current) {
        cancel();
      }
      const start = getScrollStart.getScrollStart({ parent: scrollableRef.current, axis }) ?? 0;
      const change = getRelativePosition.getRelativePosition({
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
        setScrollParam.setScrollParam({
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
  useWindowEvent.useWindowEvent("wheel", handleStop, {
    passive: true
  });
  useWindowEvent.useWindowEvent("touchmove", handleStop, {
    passive: true
  });
  React.useEffect(() => cancel, []);
  return {
    scrollableRef,
    targetRef,
    scrollIntoView,
    cancel
  };
}

exports.useScrollIntoView = useScrollIntoView;
//# sourceMappingURL=use-scroll-into-view.cjs.map
