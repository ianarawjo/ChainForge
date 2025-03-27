'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var useResizeObserver = require('../use-resize-observer.cjs');
var ScrollAreaScrollbarVisible = require('./ScrollAreaScrollbarVisible.cjs');

const ScrollAreaScrollbarAuto = React.forwardRef(
  (props, ref) => {
    const context = ScrollArea_context.useScrollAreaContext();
    const { forceMount, ...scrollbarProps } = props;
    const [visible, setVisible] = React.useState(false);
    const isHorizontal = props.orientation === "horizontal";
    const handleResize = hooks.useDebouncedCallback(() => {
      if (context.viewport) {
        const isOverflowX = context.viewport.offsetWidth < context.viewport.scrollWidth;
        const isOverflowY = context.viewport.offsetHeight < context.viewport.scrollHeight;
        setVisible(isHorizontal ? isOverflowX : isOverflowY);
      }
    }, 10);
    useResizeObserver.useResizeObserver(context.viewport, handleResize);
    useResizeObserver.useResizeObserver(context.content, handleResize);
    if (forceMount || visible) {
      return /* @__PURE__ */ jsxRuntime.jsx(
        ScrollAreaScrollbarVisible.ScrollAreaScrollbarVisible,
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

exports.ScrollAreaScrollbarAuto = ScrollAreaScrollbarAuto;
//# sourceMappingURL=ScrollAreaScrollbarAuto.cjs.map
