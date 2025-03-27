'use client';
import { getThumbRatio } from './get-thumb-ratio.mjs';

function getThumbSize(sizes) {
  const ratio = getThumbRatio(sizes.viewport, sizes.content);
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const thumbSize = (sizes.scrollbar.size - scrollbarPadding) * ratio;
  return Math.max(thumbSize, 18);
}

export { getThumbSize };
//# sourceMappingURL=get-thumb-size.mjs.map
