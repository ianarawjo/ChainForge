'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useRef, useState } from 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { useDirection } from '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { getThumbRatio } from '../utils/get-thumb-ratio.mjs';
import { getThumbOffsetFromScroll } from '../utils/get-thumb-offset-from-scroll.mjs';
import { getScrollPositionFromPointer } from '../utils/get-scroll-position-from-pointer.mjs';
import { ScrollAreaScrollbarX } from './ScrollbarX.mjs';
import { ScrollAreaScrollbarY } from './ScrollbarY.mjs';

const ScrollAreaScrollbarVisible = forwardRef((props, forwardedRef) => {
  const { orientation = "vertical", ...scrollbarProps } = props;
  const { dir } = useDirection();
  const context = useScrollAreaContext();
  const thumbRef = useRef(null);
  const pointerOffsetRef = useRef(0);
  const [sizes, setSizes] = useState({
    content: 0,
    viewport: 0,
    scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 }
  });
  const thumbRatio = getThumbRatio(sizes.viewport, sizes.content);
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
  const getScrollPosition = (pointerPos, direction) => getScrollPositionFromPointer(pointerPos, pointerOffsetRef.current, sizes, direction);
  if (orientation === "horizontal") {
    return /* @__PURE__ */ jsx(
      ScrollAreaScrollbarX,
      {
        ...commonProps,
        ref: forwardedRef,
        onThumbPositionChange: () => {
          if (context.viewport && thumbRef.current) {
            const scrollPos = context.viewport.scrollLeft;
            const offset = getThumbOffsetFromScroll(scrollPos, sizes, dir);
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
    return /* @__PURE__ */ jsx(
      ScrollAreaScrollbarY,
      {
        ...commonProps,
        ref: forwardedRef,
        onThumbPositionChange: () => {
          if (context.viewport && thumbRef.current) {
            const scrollPos = context.viewport.scrollTop;
            const offset = getThumbOffsetFromScroll(scrollPos, sizes);
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

export { ScrollAreaScrollbarVisible };
//# sourceMappingURL=ScrollAreaScrollbarVisible.mjs.map
