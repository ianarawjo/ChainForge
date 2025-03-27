'use client';
import { rem } from '../../../../utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';

const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
function fontSizeResolver(value, theme) {
  if (typeof value === "string" && value in theme.fontSizes) {
    return `var(--mantine-font-size-${value})`;
  }
  if (typeof value === "string" && headings.includes(value)) {
    return `var(--mantine-${value}-font-size)`;
  }
  if (typeof value === "number") {
    return rem(value);
  }
  if (typeof value === "string") {
    return rem(value);
  }
  return value;
}

export { fontSizeResolver };
//# sourceMappingURL=font-size-resolver.mjs.map
