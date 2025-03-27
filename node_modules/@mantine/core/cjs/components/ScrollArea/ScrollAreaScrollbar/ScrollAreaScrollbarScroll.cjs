'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var composeEventHandlers = require('../utils/compose-event-handlers.cjs');
var ScrollAreaScrollbarVisible = require('./ScrollAreaScrollbarVisible.cjs');

const ScrollAreaScrollbarScroll = React.forwardRef(
  (props, red) => {
    const { forceMount, ...scrollbarProps } = props;
    const context = ScrollArea_context.useScrollAreaContext();
    const isHorizontal = props.orientation === "horizontal";
    const [state, setState] = React.useState("hidden");
    const debounceScrollEnd = hooks.useDebouncedCallback(() => setState("idle"), 100);
    React.useEffect(() => {
      if (state === "idle") {
        const hideTimer = window.setTimeout(() => setState("hidden"), context.scrollHideDelay);
        return () => window.clearTimeout(hideTimer);
      }
      return void 0;
    }, [state, context.scrollHideDelay]);
    React.useEffect(() => {
      const { viewport } = context;
      const scrollDirection = isHorizontal ? "scrollLeft" : "scrollTop";
      if (viewport) {
        let prevScrollPos = viewport[scrollDirection];
        const handleScroll = () => {
          const scrollPos = viewport[scrollDirection];
          const hasScrollInDirectionChanged = prevScrollPos !== scrollPos;
          if (hasScrollInDirectionChanged) {
            setState("scrolling");
            debounceScrollEnd();
          }
          prevScrollPos = scrollPos;
        };
        viewport.addEventListener("scroll", handleScroll);
        return () => viewport.removeEventListener("scroll", handleScroll);
      }
      return void 0;
    }, [context.viewport, isHorizontal, debounceScrollEnd]);
    if (forceMount || state !== "hidden") {
      return /* @__PURE__ */ jsxRuntime.jsx(
        ScrollAreaScrollbarVisible.ScrollAreaScrollbarVisible,
        {
          "data-state": state === "hidden" ? "hidden" : "visible",
          ...scrollbarProps,
          ref: red,
          onPointerEnter: composeEventHandlers.composeEventHandlers(props.onPointerEnter, () => setState("interacting")),
          onPointerLeave: composeEventHandlers.composeEventHandlers(props.onPointerLeave, () => setState("idle"))
        }
      );
    }
    return null;
  }
);

exports.ScrollAreaScrollbarScroll = ScrollAreaScrollbarScroll;
//# sourceMappingURL=ScrollAreaScrollbarScroll.cjs.map
