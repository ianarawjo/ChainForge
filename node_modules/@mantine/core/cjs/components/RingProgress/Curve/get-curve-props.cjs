'use client';
'use strict';

function getCurveProps({ size, thickness, sum, value, root, offset }) {
  const radius = (size * 0.9 - thickness * 2) / 2;
  const deg = Math.PI * radius * 2 / 100;
  const strokeDasharray = root || value === void 0 ? `${(100 - sum) * deg}, ${sum * deg}` : `${value * deg}, ${(100 - value) * deg}`;
  return {
    strokeWidth: Number.isNaN(thickness) ? 12 : thickness,
    cx: size / 2 || 0,
    cy: size / 2 || 0,
    r: radius || 0,
    transform: root ? `scale(1, -1) translate(0, -${size})` : void 0,
    strokeDasharray,
    strokeDashoffset: root ? 0 : offset || 0
  };
}

exports.getCurveProps = getCurveProps;
//# sourceMappingURL=get-curve-props.cjs.map
