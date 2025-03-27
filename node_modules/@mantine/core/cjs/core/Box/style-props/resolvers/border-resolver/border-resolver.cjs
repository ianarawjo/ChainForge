'use client';
'use strict';

var rem = require('../../../../utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var colorResolver = require('../color-resolver/color-resolver.cjs');

function borderResolver(value, theme) {
  if (typeof value === "number") {
    return rem.rem(value);
  }
  if (typeof value === "string") {
    const [size, style, ...colorTuple] = value.split(" ").filter((val) => val.trim() !== "");
    let result = `${rem.rem(size)}`;
    style && (result += ` ${style}`);
    colorTuple.length > 0 && (result += ` ${colorResolver.colorResolver(colorTuple.join(" "), theme)}`);
    return result.trim();
  }
  return value;
}

exports.borderResolver = borderResolver;
//# sourceMappingURL=border-resolver.cjs.map
