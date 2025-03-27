'use strict';

require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var colorsTuple = require('../../color-functions/colors-tuple/colors-tuple.cjs');

function virtualColor(input) {
  const result = colorsTuple.colorsTuple(
    Array.from({ length: 10 }).map((_, i) => `var(--mantine-color-${input.name}-${i})`)
  );
  Object.defineProperty(result, "mantine-virtual-color", {
    enumerable: false,
    writable: false,
    configurable: false,
    value: true
  });
  Object.defineProperty(result, "dark", {
    enumerable: false,
    writable: false,
    configurable: false,
    value: input.dark
  });
  Object.defineProperty(result, "light", {
    enumerable: false,
    writable: false,
    configurable: false,
    value: input.light
  });
  Object.defineProperty(result, "name", {
    enumerable: false,
    writable: false,
    configurable: false,
    value: input.name
  });
  return result;
}
function isVirtualColor(value) {
  return !!value && typeof value === "object" && "mantine-virtual-color" in value;
}

exports.isVirtualColor = isVirtualColor;
exports.virtualColor = virtualColor;
//# sourceMappingURL=virtual-color.cjs.map
