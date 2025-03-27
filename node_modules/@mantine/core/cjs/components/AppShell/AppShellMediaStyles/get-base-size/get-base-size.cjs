'use client';
'use strict';

function getBaseSize(size) {
  if (typeof size === "object") {
    return size.base;
  }
  return size;
}

exports.getBaseSize = getBaseSize;
//# sourceMappingURL=get-base-size.cjs.map
