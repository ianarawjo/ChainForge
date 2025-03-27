'use client';
'use strict';

var getPrimaryShade = require('../get-primary-shade/get-primary-shade.cjs');
var parseThemeColor = require('../parse-theme-color/parse-theme-color.cjs');

function getContrastColor({ color, theme, autoContrast }) {
  const _autoContrast = typeof autoContrast === "boolean" ? autoContrast : theme.autoContrast;
  if (!_autoContrast) {
    return "var(--mantine-color-white)";
  }
  const parsed = parseThemeColor.parseThemeColor({ color: color || theme.primaryColor, theme });
  return parsed.isLight ? "var(--mantine-color-black)" : "var(--mantine-color-white)";
}
function getPrimaryContrastColor(theme, colorScheme) {
  return getContrastColor({
    color: theme.colors[theme.primaryColor][getPrimaryShade.getPrimaryShade(theme, colorScheme)],
    theme,
    autoContrast: null
  });
}

exports.getContrastColor = getContrastColor;
exports.getPrimaryContrastColor = getPrimaryContrastColor;
//# sourceMappingURL=get-contrast-color.cjs.map
