'use client';
'use strict';

function getSafeId(uid, errorMessage) {
  return (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(errorMessage);
    }
    return `${uid}-${value}`;
  };
}

exports.getSafeId = getSafeId;
//# sourceMappingURL=get-safe-id.cjs.map
