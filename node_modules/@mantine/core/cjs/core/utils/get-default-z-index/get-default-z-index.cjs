'use client';
'use strict';

const elevations = {
  app: 100,
  modal: 200,
  popover: 300,
  overlay: 400,
  max: 9999
};
function getDefaultZIndex(level) {
  return elevations[level];
}

exports.getDefaultZIndex = getDefaultZIndex;
//# sourceMappingURL=get-default-z-index.cjs.map
