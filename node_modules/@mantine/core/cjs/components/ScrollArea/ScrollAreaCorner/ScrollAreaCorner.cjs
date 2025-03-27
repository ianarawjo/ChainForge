'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var ScrollArea_context = require('../ScrollArea.context.cjs');
var useResizeObserver = require('../use-resize-observer.cjs');

const Corner = React.forwardRef((props, ref) => {
  const { style, ...others } = props;
  const ctx = ScrollArea_context.useScrollAreaContext();
  const [width, setWidth] = React.useState(0);
  const [height, setHeight] = React.useState(0);
  const hasSize = Boolean(width && height);
  useResizeObserver.useResizeObserver(ctx.scrollbarX, () => {
    const h = ctx.scrollbarX?.offsetHeight || 0;
    ctx.onCornerHeightChange(h);
    setHeight(h);
  });
  useResizeObserver.useResizeObserver(ctx.scrollbarY, () => {
    const w = ctx.scrollbarY?.offsetWidth || 0;
    ctx.onCornerWidthChange(w);
    setWidth(w);
  });
  return hasSize ? /* @__PURE__ */ jsxRuntime.jsx("div", { ...others, ref, style: { ...style, width, height } }) : null;
});
const ScrollAreaCorner = React.forwardRef((props, ref) => {
  const ctx = ScrollArea_context.useScrollAreaContext();
  const hasBothScrollbarsVisible = Boolean(ctx.scrollbarX && ctx.scrollbarY);
  const hasCorner = ctx.type !== "scroll" && hasBothScrollbarsVisible;
  return hasCorner ? /* @__PURE__ */ jsxRuntime.jsx(Corner, { ...props, ref }) : null;
});

exports.Corner = Corner;
exports.ScrollAreaCorner = ScrollAreaCorner;
//# sourceMappingURL=ScrollAreaCorner.cjs.map
