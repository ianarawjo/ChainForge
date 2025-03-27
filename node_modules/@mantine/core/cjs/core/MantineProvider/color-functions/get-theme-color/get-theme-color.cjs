'use client';
'use strict';

var parseThemeColor = require('../parse-theme-color/parse-theme-color.cjs');

function getThemeColor(color, theme) {
  const parsed = parseThemeColor.parseThemeColor({ color: color || theme.primaryColor, theme });
  return parsed.variable ? `var(${parsed.variable})` : color;
}

exports.getThemeColor = getThemeColor;
//# sourceMappingURL=get-theme-color.cjs.map
