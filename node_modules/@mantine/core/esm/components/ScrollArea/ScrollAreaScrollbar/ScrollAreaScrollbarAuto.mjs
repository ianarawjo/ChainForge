'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { useResizeObserver } from '../use-resize-observer.mjs';
import { ScrollAreaScrollbarVisible } from './ScrollAreaScrollbarVisible.mjs';

const ScrollAreaScrollbarAuto = forwardRef(
  (props, ref) => {
    const context = useScrollAreaContext();
    const { forceMount, ...scrollbarProps } = props;
    const [visible, setVisible] = useState(false);
    const isHorizontal = props.orientation === "horizontal";
    const handleResize = useDebouncedCallback(() => {
      if (context.viewport) {
        const isOverflowX = context.viewport.offsetWidth < context.viewport.scrollWidth;
        const isOverflowY = context.viewport.offsetHeight < context.viewport.scrollHeight;
        setVisible(isHorizontal ? isOverflowX : isOverflowY);
      }
    }, 10);
    useResizeObserver(context.viewport, handleResize);
    useResizeObserver(context.content, handleResize);
    if (forceMount || visible) {
      return /* @__PURE__ */ jsx(
        ScrollAreaScrollbarVisible,
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
ScrollAreaScrollbarAuto.displayName = "@mantine/core/ScrollAreaScrollbarAuto";

export { ScrollAreaScrollbarAuto };
//# sourceMappingURL=ScrollAreaScrollbarAuto.mjs.map
