'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, useState } from 'react';
import { useScrollAreaContext } from '../ScrollArea.context.mjs';
import { useResizeObserver } from '../use-resize-observer.mjs';

const Corner = forwardRef((props, ref) => {
  const { style, ...others } = props;
  const ctx = useScrollAreaContext();
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const hasSize = Boolean(width && height);
  useResizeObserver(ctx.scrollbarX, () => {
    const h = ctx.scrollbarX?.offsetHeight || 0;
    ctx.onCornerHeightChange(h);
    setHeight(h);
  });
  useResizeObserver(ctx.scrollbarY, () => {
    const w = ctx.scrollbarY?.offsetWidth || 0;
    ctx.onCornerWidthChange(w);
    setWidth(w);
  });
  return hasSize ? /* @__PURE__ */ jsx("div", { ...others, ref, style: { ...style, width, height } }) : null;
});
const ScrollAreaCorner = forwardRef((props, ref) => {
  const ctx = useScrollAreaContext();
  const hasBothScrollbarsVisible = Boolean(ctx.scrollbarX && ctx.scrollbarY);
  const hasCorner = ctx.type !== "scroll" && hasBothScrollbarsVisible;
  return hasCorner ? /* @__PURE__ */ jsx(Corner, { ...props, ref }) : null;
});

export { Corner, ScrollAreaCorner };
//# sourceMappingURL=ScrollAreaCorner.mjs.map
