'use client';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useDidUpdate, mergeRefs } from '@mantine/hooks';

function getAutoHeightDuration(height) {
  if (!height || typeof height === "string") {
    return 0;
  }
  const constant = height / 36;
  return Math.round((4 + 15 * constant ** 0.25 + constant / 5) * 10);
}
function getElementHeight(el) {
  return el?.current ? el.current.scrollHeight : "auto";
}
const raf = typeof window !== "undefined" && window.requestAnimationFrame;
function useCollapse({
  transitionDuration,
  transitionTimingFunction = "ease",
  onTransitionEnd = () => {
  },
  opened
}) {
  const el = useRef(null);
  const collapsedHeight = 0;
  const collapsedStyles = {
    display: "none",
    height: 0,
    overflow: "hidden"
  };
  const [styles, setStylesRaw] = useState(opened ? {} : collapsedStyles);
  const setStyles = (newStyles) => {
    flushSync(() => setStylesRaw(newStyles));
  };
  const mergeStyles = (newStyles) => {
    setStyles((oldStyles) => ({ ...oldStyles, ...newStyles }));
  };
  function getTransitionStyles(height) {
    const _duration = transitionDuration || getAutoHeightDuration(height);
    return {
      transition: `height ${_duration}ms ${transitionTimingFunction}, opacity ${_duration}ms ${transitionTimingFunction}`
    };
  }
  useDidUpdate(() => {
    if (typeof raf === "function") {
      if (opened) {
        raf(() => {
          mergeStyles({ willChange: "height", display: "block", overflow: "hidden" });
          raf(() => {
            const height = getElementHeight(el);
            mergeStyles({ ...getTransitionStyles(height), height });
          });
        });
      } else {
        raf(() => {
          const height = getElementHeight(el);
          mergeStyles({ ...getTransitionStyles(height), willChange: "height", height });
          raf(() => mergeStyles({ height: collapsedHeight, overflow: "hidden" }));
        });
      }
    }
  }, [opened]);
  const handleTransitionEnd = (e) => {
    if (e.target !== el.current || e.propertyName !== "height") {
      return;
    }
    if (opened) {
      const height = getElementHeight(el);
      if (height === styles.height) {
        setStyles({});
      } else {
        mergeStyles({ height });
      }
      onTransitionEnd();
    } else if (styles.height === collapsedHeight) {
      setStyles(collapsedStyles);
      onTransitionEnd();
    }
  };
  function getCollapseProps({ style = {}, refKey = "ref", ...rest } = {}) {
    const theirRef = rest[refKey];
    return {
      "aria-hidden": !opened,
      ...rest,
      [refKey]: mergeRefs(el, theirRef),
      onTransitionEnd: handleTransitionEnd,
      style: { boxSizing: "border-box", ...style, ...styles }
    };
  }
  return getCollapseProps;
}

export { getElementHeight, useCollapse };
//# sourceMappingURL=use-collapse.mjs.map
