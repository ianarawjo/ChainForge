'use client';
function getChangeValue({
  value,
  containerWidth,
  min,
  max,
  step,
  precision
}) {
  const left = !containerWidth ? value : Math.min(Math.max(value, 0), containerWidth) / containerWidth;
  const dx = left * (max - min);
  const nextValue = (dx !== 0 ? Math.round(dx / step) * step : 0) + min;
  const nextValueWithinStep = Math.max(nextValue, min);
  if (precision !== void 0) {
    return Number(nextValueWithinStep.toFixed(precision));
  }
  return nextValueWithinStep;
}

export { getChangeValue };
//# sourceMappingURL=get-change-value.mjs.map
