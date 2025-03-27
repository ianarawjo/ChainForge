'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useState, useRef, useEffect } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { isScrollingWithinScrollbarBounds } from '../utils/is-scrolling-within-scrollbar-bounds.mjs';
import { getThumbSize } from '../utils/get-thumb-size.mjs';
import { toInt } from '../utils/to-int.mjs';
import { Scrollbar } from './Scrollbar.mjs';

const ScrollAreaScrollbarY = forwardRef(
  (props, forwardedRef) => {
    const { sizes, onSizesChange, style, ...others } = props;
    const context = useScrollAreaContext();
    const [computedStyle, setComputedStyle] = useState();
    const ref = useRef(null);
    const composeRefs = useMergedRef(forwardedRef, ref, context.onScrollbarYChange);
    useEffect(() => {
      if (ref.current) {
        setComputedStyle(window.getComputedStyle(ref.current));
      }
    }, []);
    return /* @__PURE__ */ jsx(
      Scrollbar,
      {
        ...others,
        "data-orientation": "vertical",
        ref: composeRefs,
        sizes,
        style: {
          ["--sa-thumb-height"]: `${getThumbSize(sizes)}px`,
          ...style
        },
        onThumbPointerDown: (pointerPos) => props.onThumbPointerDown(pointerPos.y),
        onDragScroll: (pointerPos) => props.onDragScroll(pointerPos.y),
        onWheelScroll: (event, maxScrollPos) => {
          if (context.viewport) {
            const scrollPos = context.viewport.scrollTop + event.deltaY;
            props.onWheelScroll(scrollPos);
            if (isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) {
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
                paddingStart: toInt(computedStyle.paddingTop),
                paddingEnd: toInt(computedStyle.paddingBottom)
              }
            });
          }
        }
      }
    );
  }
);
ScrollAreaScrollbarY.displayName = "@mantine/core/ScrollAreaScrollbarY";

export { ScrollAreaScrollbarY };
//# sourceMappingURL=ScrollbarY.mjs.map
