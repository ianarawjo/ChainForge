'use client';
'use strict';

var getThemeColor = require('../get-theme-color/get-theme-color.cjs');

function getGradient(gradient, theme) {
  const merged = {
    from: gradient?.from || theme.defaultGradient.from,
    to: gradient?.to || theme.defaultGradient.to,
    deg: gradient?.deg ?? theme.defaultGradient.deg ?? 0
  };
  const fromColor = getThemeColor.getThemeColor(merged.from, theme);
  const toColor = getThemeColor.getThemeColor(merged.to, theme);
  return `linear-gradient(${merged.deg}deg, ${fromColor} 0%, ${toColor} 100%)`;
}

exports.getGradient = getGradient;
//# sourceMappingURL=get-gradient.cjs.map
