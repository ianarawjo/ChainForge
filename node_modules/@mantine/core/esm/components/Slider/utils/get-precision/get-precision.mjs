'use client';
function getPrecision(step) {
  if (!step) {
    return 0;
  }
  const split = step.toString().split(".");
  return split.length > 1 ? split[1].length : 0;
}

export { getPrecision };
//# sourceMappingURL=get-precision.mjs.map
