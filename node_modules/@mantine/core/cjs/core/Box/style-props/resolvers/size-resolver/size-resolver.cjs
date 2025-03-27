'use client';
'use strict';

var rem = require('../../../../utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');

function sizeResolver(value) {
  if (typeof value === "number") {
    return rem.rem(value);
  }
  return value;
}

exports.sizeResolver = sizeResolver;
//# sourceMappingURL=size-resolver.cjs.map
