'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useState, useRef, useEffect } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { isScrollingWithinScrollbarBounds } from '../utils/is-scrolling-within-scrollbar-bounds.mjs';
import { getThumbSize } from '../utils/get-thumb-size.mjs';
import { toInt } from '../utils/to-int.mjs';
import { Scrollbar } from './Scrollbar.mjs';

const ScrollAreaScrollbarX = forwardRef(
  (props, forwardedRef) => {
    const { sizes, onSizesChange, style, ...others } = props;
    const ctx = useScrollAreaContext();
    const [computedStyle, setComputedStyle] = useState();
    const ref = useRef(null);
    const composeRefs = useMergedRef(forwardedRef, ref, ctx.onScrollbarXChange);
    useEffect(() => {
      if (ref.current) {
        setComputedStyle(getComputedStyle(ref.current));
      }
    }, [ref]);
    return /* @__PURE__ */ jsx(
      Scrollbar,
      {
        "data-orientation": "horizontal",
        ...others,
        ref: composeRefs,
        sizes,
        style: {
          ...style,
          ["--sa-thumb-width"]: `${getThumbSize(sizes)}px`
        },
        onThumbPointerDown: (pointerPos) => props.onThumbPointerDown(pointerPos.x),
        onDragScroll: (pointerPos) => props.onDragScroll(pointerPos.x),
        onWheelScroll: (event, maxScrollPos) => {
          if (ctx.viewport) {
            const scrollPos = ctx.viewport.scrollLeft + event.deltaX;
            props.onWheelScroll(scrollPos);
            if (isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos)) {
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
                paddingStart: toInt(computedStyle.paddingLeft),
                paddingEnd: toInt(computedStyle.paddingRight)
              }
            });
          }
        }
      }
    );
  }
);
ScrollAreaScrollbarX.displayName = "@mantine/core/ScrollAreaScrollbarX";

export { ScrollAreaScrollbarX };
//# sourceMappingURL=ScrollbarX.mjs.map
