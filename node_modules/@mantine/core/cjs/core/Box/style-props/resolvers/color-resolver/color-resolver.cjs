'use client';
'use strict';

var parseThemeColor = require('../../../../MantineProvider/color-functions/parse-theme-color/parse-theme-color.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
require('../../../../MantineProvider/Mantine.context.cjs');
require('../../../../MantineProvider/default-theme.cjs');
require('../../../../MantineProvider/MantineProvider.cjs');
require('../../../../MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../../MantineProvider/MantineCssVariables/MantineCssVariables.cjs');

function colorResolver(color, theme) {
  const parsedColor = parseThemeColor.parseThemeColor({ color, theme });
  if (parsedColor.color === "dimmed") {
    return "var(--mantine-color-dimmed)";
  }
  if (parsedColor.color === "bright") {
    return "var(--mantine-color-bright)";
  }
  return parsedColor.variable ? `var(${parsedColor.variable})` : parsedColor.color;
}
function textColorResolver(color, theme) {
  const parsedColor = parseThemeColor.parseThemeColor({ color, theme });
  if (parsedColor.isThemeColor && parsedColor.shade === void 0) {
    return `var(--mantine-color-${parsedColor.color}-text)`;
  }
  return colorResolver(color, theme);
}

exports.colorResolver = colorResolver;
exports.textColorResolver = textColorResolver;
//# sourceMappingURL=color-resolver.cjs.map
