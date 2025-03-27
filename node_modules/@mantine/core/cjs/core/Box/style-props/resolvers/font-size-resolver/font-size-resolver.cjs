'use client';
'use strict';

var rem = require('../../../../utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');

const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
function fontSizeResolver(value, theme) {
  if (typeof value === "string" && value in theme.fontSizes) {
    return `var(--mantine-font-size-${value})`;
  }
  if (typeof value === "string" && headings.includes(value)) {
    return `var(--mantine-${value}-font-size)`;
  }
  if (typeof value === "number") {
    return rem.rem(value);
  }
  if (typeof value === "string") {
    return rem.rem(value);
  }
  return value;
}

exports.fontSizeResolver = fontSizeResolver;
//# sourceMappingURL=font-size-resolver.cjs.map
