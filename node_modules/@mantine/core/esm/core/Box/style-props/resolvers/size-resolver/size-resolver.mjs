'use client';
import { rem } from '../../../../utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';

function sizeResolver(value) {
  if (typeof value === "number") {
    return rem(value);
  }
  return value;
}

export { sizeResolver };
//# sourceMappingURL=size-resolver.mjs.map
