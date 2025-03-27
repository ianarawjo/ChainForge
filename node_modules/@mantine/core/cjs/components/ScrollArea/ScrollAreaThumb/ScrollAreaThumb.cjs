'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var Scrollbar_context = require('../ScrollAreaScrollbar/Scrollbar.context.cjs');
var composeEventHandlers = require('../utils/compose-event-handlers.cjs');
var addUnlinkedScrollListener = require('../utils/add-unlinked-scroll-listener.cjs');

const Thumb = React.forwardRef((props, forwardedRef) => {
  const { style, ...others } = props;
  const scrollAreaContext = ScrollArea_context.useScrollAreaContext();
  const scrollbarContext = Scrollbar_context.useScrollbarContext();
  const { onThumbPositionChange } = scrollbarContext;
  const composedRef = hooks.useMergedRef(forwardedRef, (node) => scrollbarContext.onThumbChange(node));
  const removeUnlinkedScrollListenerRef = React.useRef(void 0);
  const debounceScrollEnd = hooks.useDebouncedCallback(() => {
    if (removeUnlinkedScrollListenerRef.current) {
      removeUnlinkedScrollListenerRef.current();
      removeUnlinkedScrollListenerRef.current = void 0;
    }
  }, 100);
  React.useEffect(() => {
    const { viewport } = scrollAreaContext;
    if (viewport) {
      const handleScroll = () => {
        debounceScrollEnd();
        if (!removeUnlinkedScrollListenerRef.current) {
          const listener = addUnlinkedScrollListener.addUnlinkedScrollListener(viewport, onThumbPositionChange);
          removeUnlinkedScrollListenerRef.current = listener;
          onThumbPositionChange();
        }
      };
      onThumbPositionChange();
      viewport.addEventListener("scroll", handleScroll);
      return () => viewport.removeEventListener("scroll", handleScroll);
    }
    return void 0;
  }, [scrollAreaContext.viewport, debounceScrollEnd, onThumbPositionChange]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      "data-state": scrollbarContext.hasThumb ? "visible" : "hidden",
      ...others,
      ref: composedRef,
      style: {
        width: "var(--sa-thumb-width)",
        height: "var(--sa-thumb-height)",
        ...style
      },
      onPointerDownCapture: composeEventHandlers.composeEventHandlers(props.onPointerDownCapture, (event) => {
        const thumb = event.target;
        const thumbRect = thumb.getBoundingClientRect();
        const x = event.clientX - thumbRect.left;
        const y = event.clientY - thumbRect.top;
        scrollbarContext.onThumbPointerDown({ x, y });
      }),
      onPointerUp: composeEventHandlers.composeEventHandlers(props.onPointerUp, scrollbarContext.onThumbPointerUp)
    }
  );
});
Thumb.displayName = "@mantine/core/ScrollAreaThumb";
const ScrollAreaThumb = React.forwardRef(
  (props, forwardedRef) => {
    const { forceMount, ...thumbProps } = props;
    const scrollbarContext = Scrollbar_context.useScrollbarContext();
    if (forceMount || scrollbarContext.hasThumb) {
      return /* @__PURE__ */ jsxRuntime.jsx(Thumb, { ref: forwardedRef, ...thumbProps });
    }
    return null;
  }
);
ScrollAreaThumb.displayName = "@mantine/core/ScrollAreaThumb";

exports.ScrollAreaThumb = ScrollAreaThumb;
exports.Thumb = Thumb;
//# sourceMappingURL=ScrollAreaThumb.cjs.map
