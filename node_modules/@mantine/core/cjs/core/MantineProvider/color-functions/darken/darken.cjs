'use strict';

var toRgba = require('../to-rgba/to-rgba.cjs');

function darken(color, alpha) {
  if (color.startsWith("var(")) {
    return `color-mix(in srgb, ${color}, black ${alpha * 100}%)`;
  }
  const { r, g, b, a } = toRgba.toRgba(color);
  const f = 1 - alpha;
  const dark = (input) => Math.round(input * f);
  return `rgba(${dark(r)}, ${dark(g)}, ${dark(b)}, ${a})`;
}

exports.darken = darken;
//# sourceMappingURL=darken.cjs.map
