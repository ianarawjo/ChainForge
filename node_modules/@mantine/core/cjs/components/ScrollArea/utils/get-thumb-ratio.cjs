'use client';
'use strict';

function getThumbRatio(viewportSize, contentSize) {
  const ratio = viewportSize / contentSize;
  return Number.isNaN(ratio) ? 0 : ratio;
}

exports.getThumbRatio = getThumbRatio;
//# sourceMappingURL=get-thumb-ratio.cjs.map
