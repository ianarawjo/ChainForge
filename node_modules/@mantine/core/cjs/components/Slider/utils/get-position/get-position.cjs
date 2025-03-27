'use client';
'use strict';

function getPosition({ value, min, max }) {
  const position = (value - min) / (max - min) * 100;
  return Math.min(Math.max(position, 0), 100);
}

exports.getPosition = getPosition;
//# sourceMappingURL=get-position.cjs.map
