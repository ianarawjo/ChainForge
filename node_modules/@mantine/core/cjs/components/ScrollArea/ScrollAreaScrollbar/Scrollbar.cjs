'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var useResizeObserver = require('../use-resize-observer.cjs');
var composeEventHandlers = require('../utils/compose-event-handlers.cjs');
var Scrollbar_context = require('./Scrollbar.context.cjs');

const Scrollbar = React.forwardRef((props, forwardedRef) => {
  const {
    sizes,
    hasThumb,
    onThumbChange,
    onThumbPointerUp,
    onThumbPointerDown,
    onThumbPositionChange,
    onDragScroll,
    onWheelScroll,
    onResize,
    ...scrollbarProps
  } = props;
  const context = ScrollArea_context.useScrollAreaContext();
  const [scrollbar, setScrollbar] = React.useState(null);
  const composeRefs = hooks.useMergedRef(forwardedRef, (node) => setScrollbar(node));
  const rectRef = React.useRef(null);
  const prevWebkitUserSelectRef = React.useRef("");
  const { viewport } = context;
  const maxScrollPos = sizes.content - sizes.viewport;
  const handleWheelScroll = hooks.useCallbackRef(onWheelScroll);
  const handleThumbPositionChange = hooks.useCallbackRef(onThumbPositionChange);
  const handleResize = hooks.useDebouncedCallback(onResize, 10);
  const handleDragScroll = (event) => {
    if (rectRef.current) {
      const x = event.clientX - rectRef.current.left;
      const y = event.clientY - rectRef.current.top;
      onDragScroll({ x, y });
    }
  };
  React.useEffect(() => {
    const handleWheel = (event) => {
      const element = event.target;
      const isScrollbarWheel = scrollbar?.contains(element);
      if (isScrollbarWheel) {
        handleWheelScroll(event, maxScrollPos);
      }
    };
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => document.removeEventListener("wheel", handleWheel, { passive: false });
  }, [viewport, scrollbar, maxScrollPos, handleWheelScroll]);
  React.useEffect(handleThumbPositionChange, [sizes, handleThumbPositionChange]);
  useResizeObserver.useResizeObserver(scrollbar, handleResize);
  useResizeObserver.useResizeObserver(context.content, handleResize);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Scrollbar_context.ScrollbarProvider,
    {
      value: {
        scrollbar,
        hasThumb,
        onThumbChange: hooks.useCallbackRef(onThumbChange),
        onThumbPointerUp: hooks.useCallbackRef(onThumbPointerUp),
        onThumbPositionChange: handleThumbPositionChange,
        onThumbPointerDown: hooks.useCallbackRef(onThumbPointerDown)
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          ...scrollbarProps,
          ref: composeRefs,
          "data-mantine-scrollbar": true,
          style: { position: "absolute", ...scrollbarProps.style },
          onPointerDown: composeEventHandlers.composeEventHandlers(props.onPointerDown, (event) => {
            event.preventDefault();
            const mainPointer = 0;
            if (event.button === mainPointer) {
              const element = event.target;
              element.setPointerCapture(event.pointerId);
              rectRef.current = scrollbar.getBoundingClientRect();
              prevWebkitUserSelectRef.current = document.body.style.webkitUserSelect;
              document.body.style.webkitUserSelect = "none";
              handleDragScroll(event);
            }
          }),
          onPointerMove: composeEventHandlers.composeEventHandlers(props.onPointerMove, handleDragScroll),
          onPointerUp: composeEventHandlers.composeEventHandlers(props.onPointerUp, (event) => {
            const element = event.target;
            if (element.hasPointerCapture(event.pointerId)) {
              event.preventDefault();
              element.releasePointerCapture(event.pointerId);
            }
          }),
          onLostPointerCapture: () => {
            document.body.style.webkitUserSelect = prevWebkitUserSelectRef.current;
            rectRef.current = null;
          }
        }
      )
    }
  );
});

exports.Scrollbar = Scrollbar;
//# sourceMappingURL=Scrollbar.cjs.map
