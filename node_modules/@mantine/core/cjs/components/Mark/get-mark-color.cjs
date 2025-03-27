'use client';
'use strict';

require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
require('clsx');
var parseThemeColor = require('../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

function getMarkColor({ color, theme, defaultShade }) {
  const parsed = parseThemeColor.parseThemeColor({ color, theme });
  if (!parsed.isThemeColor) {
    return color;
  }
  if (parsed.shade === void 0) {
    return `var(--mantine-color-${parsed.color}-${defaultShade})`;
  }
  return `var(${parsed.variable})`;
}

exports.getMarkColor = getMarkColor;
//# sourceMappingURL=get-mark-color.cjs.map
