'use client';
import { rem } from '../../../../utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';

function spacingResolver(value, theme) {
  if (typeof value === "number") {
    return rem(value);
  }
  if (typeof value === "string") {
    const mod = value.replace("-", "");
    if (!(mod in theme.spacing)) {
      return rem(value);
    }
    const variable = `--mantine-spacing-${mod}`;
    return value.startsWith("-") ? `calc(var(${variable}) * -1)` : `var(${variable})`;
  }
  return value;
}

export { spacingResolver };
//# sourceMappingURL=spacing-resolver.mjs.map
