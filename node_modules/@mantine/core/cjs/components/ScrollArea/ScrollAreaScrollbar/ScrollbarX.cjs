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

const ScrollAreaScrollbarX = React.forwardRef(
  (props, forwardedRef) => {
    const { sizes, onSizesChange, style, ...others } = props;
    const ctx = ScrollArea_context.useScrollAreaContext();
    const [computedStyle, setComputedStyle] = React.useState();
    const ref = React.useRef(null);
    const composeRefs = hooks.useMergedRef(forwardedRef, ref, ctx.onScrollbarXChange);
    React.useEffect(() => {
      if (ref.current) {
        setComputedStyle(getComputedStyle(ref.current));
      }
    }, [ref]);
    return /* @__PURE__ */ jsxRuntime.jsx(
      Scrollbar.Scrollbar,
      {
        "data-orientation": "horizontal",
        ...others,
        ref: composeRefs,
        sizes,
        style: {
          ...style,
          ["--sa-thumb-width"]: `${getThumbSize.getThumbSize(sizes)}px`
        },
        onThumbPointerDown: (pointerPos) => props.onThumbPointerDown(pointerPos.x),
        onDragScroll: (pointerPos) => props.onDragScroll(pointerPos.x),
        onWheelScroll: (event, maxScrollPos) => {
          if (ctx.viewport) {
            const scrollPos = ctx.viewport.scrollLeft + event.deltaX;
            props.onWheelScroll(scrollPos);
            if (isScrollingWithinScrollbarBounds.isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) {
              event.preventDefault();
            }
          }
        },
        onResize: () => {
          if (ref.current && ctx.viewport && computedStyle) {
            onSizesChange({
              content: ctx.viewport.scrollWidth,
              viewport: ctx.viewport.offsetWidth,
              scrollbar: {
                size: ref.current.clientWidth,
                paddingStart: toInt.toInt(computedStyle.paddingLeft),
                paddingEnd: toInt.toInt(computedStyle.paddingRight)
              }
            });
          }
        }
      }
    );
  }
);
ScrollAreaScrollbarX.displayName = "@mantine/core/ScrollAreaScrollbarX";

exports.ScrollAreaScrollbarX = ScrollAreaScrollbarX;
//# sourceMappingURL=ScrollbarX.cjs.map
