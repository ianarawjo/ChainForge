'use client';
function findClosestNumber(value, numbers) {
  if (numbers.length === 0) {
    return value;
  }
  return numbers.reduce(
    (prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

export { findClosestNumber };
//# sourceMappingURL=find-closest-number.mjs.map
