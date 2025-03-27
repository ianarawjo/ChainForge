'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useState, useEffect } from 'react';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { ScrollAreaScrollbarAuto } from './ScrollAreaScrollbarAuto.mjs';

const ScrollAreaScrollbarHover = forwardRef(
  (props, ref) => {
    const { forceMount, ...scrollbarProps } = props;
    const context = useScrollAreaContext();
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      const { scrollArea } = context;
      let hideTimer = 0;
      if (scrollArea) {
        const handlePointerEnter = () => {
          window.clearTimeout(hideTimer);
          setVisible(true);
        };
        const handlePointerLeave = () => {
          hideTimer = window.setTimeout(() => setVisible(false), context.scrollHideDelay);
        };
        scrollArea.addEventListener("pointerenter", handlePointerEnter);
        scrollArea.addEventListener("pointerleave", handlePointerLeave);
        return () => {
          window.clearTimeout(hideTimer);
          scrollArea.removeEventListener("pointerenter", handlePointerEnter);
          scrollArea.removeEventListener("pointerleave", handlePointerLeave);
        };
      }
      return void 0;
    }, [context.scrollArea, context.scrollHideDelay]);
    if (forceMount || visible) {
      return /* @__PURE__ */ jsx(
        ScrollAreaScrollbarAuto,
        {
          "data-state": visible ? "visible" : "hidden",
          ...scrollbarProps,
          ref
        }
      );
    }
    return null;
  }
);
ScrollAreaScrollbarHover.displayName = "@mantine/core/ScrollAreaScrollbarHover";

export { ScrollAreaScrollbarHover };
//# sourceMappingURL=ScrollAreaScrollbarHover.mjs.map
