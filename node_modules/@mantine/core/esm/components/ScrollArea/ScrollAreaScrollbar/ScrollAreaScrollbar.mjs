'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useEffect } from 'react';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { ScrollAreaScrollbarAuto } from './ScrollAreaScrollbarAuto.mjs';
import { ScrollAreaScrollbarHover } from './ScrollAreaScrollbarHover.mjs';
import { ScrollAreaScrollbarScroll } from './ScrollAreaScrollbarScroll.mjs';
import { ScrollAreaScrollbarVisible } from './ScrollAreaScrollbarVisible.mjs';

const ScrollAreaScrollbar = forwardRef(
  (props, forwardedRef) => {
    const { forceMount, ...scrollbarProps } = props;
    const context = useScrollAreaContext();
    const { onScrollbarXEnabledChange, onScrollbarYEnabledChange } = context;
    const isHorizontal = props.orientation === "horizontal";
    useEffect(() => {
      isHorizontal ? onScrollbarXEnabledChange(true) : onScrollbarYEnabledChange(true);
      return () => {
        isHorizontal ? onScrollbarXEnabledChange(false) : onScrollbarYEnabledChange(false);
      };
    }, [isHorizontal, onScrollbarXEnabledChange, onScrollbarYEnabledChange]);
    return context.type === "hover" ? /* @__PURE__ */ jsx(ScrollAreaScrollbarHover, { ...scrollbarProps, ref: forwardedRef, forceMount }) : context.type === "scroll" ? /* @__PURE__ */ jsx(ScrollAreaScrollbarScroll, { ...scrollbarProps, ref: forwardedRef, forceMount }) : context.type === "auto" ? /* @__PURE__ */ jsx(ScrollAreaScrollbarAuto, { ...scrollbarProps, ref: forwardedRef, forceMount }) : context.type === "always" ? /* @__PURE__ */ jsx(ScrollAreaScrollbarVisible, { ...scrollbarProps, ref: forwardedRef }) : null;
  }
);
ScrollAreaScrollbar.displayName = "@mantine/core/ScrollAreaScrollbar";

export { ScrollAreaScrollbar };
//# sourceMappingURL=ScrollAreaScrollbar.mjs.map
