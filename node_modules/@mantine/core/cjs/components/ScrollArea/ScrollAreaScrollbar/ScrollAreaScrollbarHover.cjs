'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var ScrollAreaScrollbarAuto = require('./ScrollAreaScrollbarAuto.cjs');

const ScrollAreaScrollbarHover = React.forwardRef(
  (props, ref) => {
    const { forceMount, ...scrollbarProps } = props;
    const context = ScrollArea_context.useScrollAreaContext();
    const [visible, setVisible] = React.useState(false);
    React.useEffect(() => {
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
      return /* @__PURE__ */ jsxRuntime.jsx(
        ScrollAreaScrollbarAuto.ScrollAreaScrollbarAuto,
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

exports.ScrollAreaScrollbarHover = ScrollAreaScrollbarHover;
//# sourceMappingURL=ScrollAreaScrollbarHover.cjs.map
