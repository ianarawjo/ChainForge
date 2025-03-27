'use client';
function isMarkFilled({ mark, offset, value, inverted = false }) {
  return inverted ? typeof offset === "number" ? mark.value <= offset || mark.value >= value : mark.value >= value : typeof offset === "number" ? mark.value >= offset && mark.value <= value : mark.value <= value;
}

export { isMarkFilled };
//# sourceMappingURL=is-mark-filled.mjs.map
