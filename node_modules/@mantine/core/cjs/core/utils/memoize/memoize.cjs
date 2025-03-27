'use client';
'use strict';

function memoize(func) {
  const cache = /* @__PURE__ */ new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  };
}

exports.memoize = memoize;
//# sourceMappingURL=memoize.cjs.map
