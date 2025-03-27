'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var ScrollAreaScrollbarAuto = require('./ScrollAreaScrollbarAuto.cjs');
var ScrollAreaScrollbarHover = require('./ScrollAreaScrollbarHover.cjs');
var ScrollAreaScrollbarScroll = require('./ScrollAreaScrollbarScroll.cjs');
var ScrollAreaScrollbarVisible = require('./ScrollAreaScrollbarVisible.cjs');

const ScrollAreaScrollbar = React.forwardRef(
  (props, forwardedRef) => {
    const { forceMount, ...scrollbarProps } = props;
    const context = ScrollArea_context.useScrollAreaContext();
    const { onScrollbarXEnabledChange, onScrollbarYEnabledChange } = context;
    const isHorizontal = props.orientation === "horizontal";
    React.useEffect(() => {
      isHorizontal ? onScrollbarXEnabledChange(true) : onScrollbarYEnabledChange(true);
      return () => {
        isHorizontal ? onScrollbarXEnabledChange(false) : onScrollbarYEnabledChange(false);
      };
    }, [isHorizontal, onScrollbarXEnabledChange, onScrollbarYEnabledChange]);
    return context.type === "hover" ? /* @__PURE__ */ jsxRuntime.jsx(ScrollAreaScrollbarHover.ScrollAreaScrollbarHover, { ...scrollbarProps, ref: forwardedRef, forceMount }) : context.type === "scroll" ? /* @__PURE__ */ jsxRuntime.jsx(ScrollAreaScrollbarScroll.ScrollAreaScrollbarScroll, { ...scrollbarProps, ref: forwardedRef, forceMount }) : context.type === "auto" ? /* @__PURE__ */ jsxRuntime.jsx(ScrollAreaScrollbarAuto.ScrollAreaScrollbarAuto, { ...scrollbarProps, ref: forwardedRef, forceMount }) : context.type === "always" ? /* @__PURE__ */ jsxRuntime.jsx(ScrollAreaScrollbarVisible.ScrollAreaScrollbarVisible, { ...scrollbarProps, ref: forwardedRef }) : null;
  }
);
ScrollAreaScrollbar.displayName = "@mantine/core/ScrollAreaScrollbar";

exports.ScrollAreaScrollbar = ScrollAreaScrollbar;
//# sourceMappingURL=ScrollAreaScrollbar.cjs.map
