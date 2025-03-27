'use client';
function getBaseValue(value) {
  if (typeof value === "object" && value !== null) {
    if ("base" in value) {
      return value.base;
    }
    return void 0;
  }
  return value;
}

export { getBaseValue };
//# sourceMappingURL=get-base-value.mjs.map
