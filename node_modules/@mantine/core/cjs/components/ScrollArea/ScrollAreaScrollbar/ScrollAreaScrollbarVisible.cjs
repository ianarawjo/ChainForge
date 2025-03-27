'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var DirectionProvider = require('../../../core/DirectionProvider/DirectionProvider.cjs');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var getThumbRatio = require('../utils/get-thumb-ratio.cjs');
var getThumbOffsetFromScroll = require('../utils/get-thumb-offset-from-scroll.cjs');
var getScrollPositionFromPointer = require('../utils/get-scroll-position-from-pointer.cjs');
var ScrollbarX = require('./ScrollbarX.cjs');
var ScrollbarY = require('./ScrollbarY.cjs');

const ScrollAreaScrollbarVisible = React.forwardRef((props, forwardedRef) => {
  const { orientation = "vertical", ...scrollbarProps } = props;
  const { dir } = DirectionProvider.useDirection();
  const context = ScrollArea_context.useScrollAreaContext();
  const thumbRef = React.useRef(null);
  const pointerOffsetRef = React.useRef(0);
  const [sizes, setSizes] = React.useState({
    content: 0,
    viewport: 0,
    scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 }
  });
  const thumbRatio = getThumbRatio.getThumbRatio(sizes.viewport, sizes.content);
  const commonProps = {
    ...scrollbarProps,
    sizes,
    onSizesChange: setSizes,
    hasThumb: Boolean(thumbRatio > 0 && thumbRatio < 1),
    onThumbChange: (thumb) => {
      thumbRef.current = thumb;
    },
    onThumbPointerUp: () => {
      pointerOffsetRef.current = 0;
    },
    onThumbPointerDown: (pointerPos) => {
      pointerOffsetRef.current = pointerPos;
    }
  };
  const getScrollPosition = (pointerPos, direction) => getScrollPositionFromPointer.getScrollPositionFromPointer(pointerPos, pointerOffsetRef.current, sizes, direction);
  if (orientation === "horizontal") {
    return /* @__PURE__ */ jsxRuntime.jsx(
      ScrollbarX.ScrollAreaScrollbarX,
      {
        ...commonProps,
        ref: forwardedRef,
        onThumbPositionChange: () => {
          if (context.viewport && thumbRef.current) {
            const scrollPos = context.viewport.scrollLeft;
            const offset = getThumbOffsetFromScroll.getThumbOffsetFromScroll(scrollPos, sizes, dir);
            thumbRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
          }
        },
        onWheelScroll: (scrollPos) => {
          if (context.viewport) {
            context.viewport.scrollLeft = scrollPos;
          }
        },
        onDragScroll: (pointerPos) => {
          if (context.viewport) {
            context.viewport.scrollLeft = getScrollPosition(pointerPos, dir);
          }
        }
      }
    );
  }
  if (orientation === "vertical") {
    return /* @__PURE__ */ jsxRuntime.jsx(
      ScrollbarY.ScrollAreaScrollbarY,
      {
        ...commonProps,
        ref: forwardedRef,
        onThumbPositionChange: () => {
          if (context.viewport && thumbRef.current) {
            const scrollPos = context.viewport.scrollTop;
            const offset = getThumbOffsetFromScroll.getThumbOffsetFromScroll(scrollPos, sizes);
            if (sizes.scrollbar.size === 0) {
              thumbRef.current.style.setProperty("--thumb-opacity", "0");
            } else {
              thumbRef.current.style.setProperty("--thumb-opacity", "1");
            }
            thumbRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
          }
        },
        onWheelScroll: (scrollPos) => {
          if (context.viewport) {
            context.viewport.scrollTop = scrollPos;
          }
        },
        onDragScroll: (pointerPos) => {
          if (context.viewport) {
            context.viewport.scrollTop = getScrollPosition(pointerPos);
          }
        }
      }
    );
  }
  return null;
});
ScrollAreaScrollbarVisible.displayName = "@mantine/core/ScrollAreaScrollbarVisible";

exports.ScrollAreaScrollbarVisible = ScrollAreaScrollbarVisible;
//# sourceMappingURL=ScrollAreaScrollbarVisible.cjs.map
