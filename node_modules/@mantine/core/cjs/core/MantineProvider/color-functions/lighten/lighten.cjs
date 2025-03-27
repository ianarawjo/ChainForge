'use strict';

var toRgba = require('../to-rgba/to-rgba.cjs');

function lighten(color, alpha) {
  if (color.startsWith("var(")) {
    return `color-mix(in srgb, ${color}, white ${alpha * 100}%)`;
  }
  const { r, g, b, a } = toRgba.toRgba(color);
  const light = (input) => Math.round(input + (255 - input) * alpha);
  return `rgba(${light(r)}, ${light(g)}, ${light(b)}, ${a})`;
}

exports.lighten = lighten;
//# sourceMappingURL=lighten.cjs.map
