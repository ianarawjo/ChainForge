'use strict';

function colorsTuple(input) {
  if (Array.isArray(input)) {
    return input;
  }
  return Array(10).fill(input);
}

exports.colorsTuple = colorsTuple;
//# sourceMappingURL=colors-tuple.cjs.map
