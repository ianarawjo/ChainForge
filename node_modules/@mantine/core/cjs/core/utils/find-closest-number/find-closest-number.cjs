'use client';
'use strict';

function findClosestNumber(value, numbers) {
  if (numbers.length === 0) {
    return value;
  }
  return numbers.reduce(
    (prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

exports.findClosestNumber = findClosestNumber;
//# sourceMappingURL=find-closest-number.cjs.map
