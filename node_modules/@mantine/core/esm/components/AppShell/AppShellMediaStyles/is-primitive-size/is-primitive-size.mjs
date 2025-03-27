'use client';
function isPrimitiveSize(size) {
  const isBaseSize = typeof size === "object" && size !== null && typeof size.base !== "undefined" && Object.keys(size).length === 1;
  return typeof size === "number" || typeof size === "string" || isBaseSize;
}

export { isPrimitiveSize };
//# sourceMappingURL=is-primitive-size.mjs.map
