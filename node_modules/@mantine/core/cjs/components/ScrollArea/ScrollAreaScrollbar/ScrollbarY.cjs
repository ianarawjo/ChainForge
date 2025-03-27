'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var isScrollingWithinScrollbarBounds = require('../utils/is-scrolling-within-scrollbar-bounds.cjs');
var getThumbSize = require('../utils/get-thumb-size.cjs');
var toInt = require('../utils/to-int.cjs');
var Scrollbar = require('./Scrollbar.cjs');

const ScrollAreaScrollbarY = React.forwardRef(
  (props, forwardedRef) => {
    const { sizes, onSizesChange, style, ...others } = props;
    const context = ScrollArea_context.useScrollAreaContext();
    const [computedStyle, setComputedStyle] = React.useState();
    const ref = React.useRef(null);
    const composeRefs = hooks.useMergedRef(forwardedRef, ref, context.onScrollbarYChange);
    React.useEffect(() => {
      if (ref.current) {
        setComputedStyle(window.getComputedStyle(ref.current));
      }
    }, []);
    return /* @__PURE__ */ jsxRuntime.jsx(
      Scrollbar.Scrollbar,
      {
        ...others,
        "data-orientation": "vertical",
        ref: composeRefs,
        sizes,
        style: {
          ["--sa-thumb-height"]: `${getThumbSize.getThumbSize(sizes)}px`,
          ...style
        },
        onThumbPointerDown: (pointerPos) => props.onThumbPointerDown(pointerPos.y),
        onDragScroll: (pointerPos) => props.onDragScroll(pointerPos.y),
        onWheelScroll: (event, maxScrollPos) => {
          if (context.viewport) {
            const scrollPos = context.viewport.scrollTop + event.deltaY;
            props.onWheelScroll(scrollPos);
            if (isScrollingWithinScrollbarBounds.isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) {
              event.preventDefault();
            }
          }
        },
        onResize: () => {
          if (ref.current && context.viewport && computedStyle) {
            onSizesChange({
              content: context.viewport.scrollHeight,
              viewport: context.viewport.offsetHeight,
              scrollbar: {
                size: ref.current.clientHeight,
                paddingStart: toInt.toInt(computedStyle.paddingTop),
                paddingEnd: toInt.toInt(computedStyle.paddingBottom)
              }
            });
          }
        }
      }
    );
  }
);
ScrollAreaScrollbarY.displayName = "@mantine/core/ScrollAreaScrollbarY";

exports.ScrollAreaScrollbarY = ScrollAreaScrollbarY;
//# sourceMappingURL=ScrollbarY.cjs.map
