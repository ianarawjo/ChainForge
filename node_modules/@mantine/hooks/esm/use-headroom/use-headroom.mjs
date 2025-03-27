'use client';
import { useRef, useState, useEffect } from 'react';
import { useIsomorphicEffect } from '../use-isomorphic-effect/use-isomorphic-effect.mjs';
import { useWindowScroll } from '../use-window-scroll/use-window-scroll.mjs';

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
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
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
  const isCurrentlyPinnedRef = useRef(false);
  const isScrollingUp = useScrollDirection();
  const [{ y: scrollPosition }] = useWindowScroll();
  useIsomorphicEffect(() => {
    isPinnedOrReleased(
      scrollPosition,
      fixedAt,
      isCurrentlyPinnedRef,
      isScrollingUp,
      onPin,
      onRelease
    );
  }, [scrollPosition]);
  useIsomorphicEffect(() => {
    if (isFixed(scrollPosition, fixedAt)) {
      onFix?.();
    }
  }, [scrollPosition, fixedAt, onFix]);
  if (isFixed(scrollPosition, fixedAt) || isScrollingUp) {
    return true;
  }
  return false;
}

export { isFixed, isPinnedOrReleased, useHeadroom, useScrollDirection };
//# sourceMappingURL=use-headroom.mjs.map
