'use client';
function isResponsiveSize(size) {
  if (typeof size !== "object" || size === null) {
    return false;
  }
  if (Object.keys(size).length === 1 && "base" in size) {
    return false;
  }
  return true;
}

export { isResponsiveSize };
//# sourceMappingURL=is-responsive-size.mjs.map
