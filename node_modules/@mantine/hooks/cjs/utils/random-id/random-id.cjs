'use client';
'use strict';

function randomId(prefix = "mantine-") {
  return `${prefix}${Math.random().toString(36).slice(2, 11)}`;
}

exports.randomId = randomId;
//# sourceMappingURL=random-id.cjs.map
