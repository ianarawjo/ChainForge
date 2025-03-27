'use client';
'use strict';

function isResponsiveSize(size) {
  if (typeof size !== "object" || size === null) {
    return false;
  }
  if (Object.keys(size).length === 1 && "base" in size) {
    return false;
  }
  return true;
}

exports.isResponsiveSize = isResponsiveSize;
//# sourceMappingURL=is-responsive-size.cjs.map
