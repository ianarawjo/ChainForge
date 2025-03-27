'use client';
'use strict';

var getThumbRatio = require('./get-thumb-ratio.cjs');

function getThumbSize(sizes) {
  const ratio = getThumbRatio.getThumbRatio(sizes.viewport, sizes.content);
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const thumbSize = (sizes.scrollbar.size - scrollbarPadding) * ratio;
  return Math.max(thumbSize, 18);
}

exports.getThumbSize = getThumbSize;
//# sourceMappingURL=get-thumb-size.cjs.map
