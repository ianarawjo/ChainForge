'use client';
'use strict';

function upperFirst(value) {
  return typeof value !== "string" ? "" : value.charAt(0).toUpperCase() + value.slice(1);
}

exports.upperFirst = upperFirst;
//# sourceMappingURL=upper-first.cjs.map
