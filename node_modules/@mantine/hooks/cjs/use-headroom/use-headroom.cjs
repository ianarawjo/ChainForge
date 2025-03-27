'use client';
'use strict';

var React = require('react');
var useIsomorphicEffect = require('../use-isomorphic-effect/use-isomorphic-effect.cjs');
var useWindowScroll = require('../use-window-scroll/use-window-scroll.cjs');

const isFixed = (current, fixedAt) => current <= fixedAt;
const isPinnedOrReleased = (current, fixedAt, isCurrentlyPinnedRef, isScrollingUp, onPin, onRelease) => {
  const isInFixedPosition = isFixed(current, fixedAt);
  if (isInFixedPosition && !isCurrentlyPinnedRef.current) {
    isCurrentlyPinnedRef.current = true;
    onPin?.();
  } else if (!isInFixedPosition && isScrollingUp && !isCurrentlyPinnedRef.current) {
    isCurrentlyPinnedRef.current = true;
    onPin?.();
  } else if (!isInFixedPosition && isCurrentlyPinnedRef.current) {
    isCurrentlyPinnedRef.current = false;
    onRelease?.();
  }
};
const useScrollDirection = () => {
  const [lastScrollTop, setLastScrollTop] = React.useState(0);
  const [isScrollingUp, setIsScrollingUp] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  React.useEffect(() => {
    let resizeTimer;
    const onResize = () => {
      setIsResizing(true);
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setIsResizing(false);
      }, 300);
    };
    const onScroll = () => {
      if (isResizing) {
        return;
      }
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsScrollingUp(currentScrollTop < lastScrollTop);
      setLastScrollTop(currentScrollTop);
    };
    window.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [lastScrollTop, isResizing]);
  return isScrollingUp;
};
function useHeadroom({ fixedAt = 0, onPin, onFix, onRelease } = {}) {
  const isCurrentlyPinnedRef = React.useRef(false);
  const isScrollingUp = useScrollDirection();
  const [{ y: scrollPosition }] = useWindowScroll.useWindowScroll();
  useIsomorphicEffect.useIsomorphicEffect(() => {
    isPinnedOrReleased(
      scrollPosition,
      fixedAt,
      isCurrentlyPinnedRef,
      isScrollingUp,
      onPin,
      onRelease
    );
  }, [scrollPosition]);
  useIsomorphicEffect.useIsomorphicEffect(() => {
    if (isFixed(scrollPosition, fixedAt)) {
      onFix?.();
    }
  }, [scrollPosition, fixedAt, onFix]);
  if (isFixed(scrollPosition, fixedAt) || isScrollingUp) {
    return true;
  }
  return false;
}

exports.isFixed = isFixed;
exports.isPinnedOrReleased = isPinnedOrReleased;
exports.useHeadroom = useHeadroom;
exports.useScrollDirection = useScrollDirection;
//# sourceMappingURL=use-headroom.cjs.map
