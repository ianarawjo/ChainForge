'use client';
'use strict';

function lowerFirst(value) {
  return typeof value !== "string" ? "" : value.charAt(0).toLowerCase() + value.slice(1);
}

exports.lowerFirst = lowerFirst;
//# sourceMappingURL=lower-first.cjs.map
