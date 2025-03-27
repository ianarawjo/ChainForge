'use client';
'use strict';

function getBaseValue(value) {
  if (typeof value === "object" && value !== null) {
    if ("base" in value) {
      return value.base;
    }
    return void 0;
  }
  return value;
}

exports.getBaseValue = getBaseValue;
//# sourceMappingURL=get-base-value.cjs.map
