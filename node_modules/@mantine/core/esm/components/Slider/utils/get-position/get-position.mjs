'use client';
function getPosition({ value, min, max }) {
  const position = (value - min) / (max - min) * 100;
  return Math.min(Math.max(position, 0), 100);
}

export { getPosition };
//# sourceMappingURL=get-position.mjs.map
