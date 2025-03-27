'use client';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import 'clsx';
import { parseThemeColor } from '../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

function getMarkColor({ color, theme, defaultShade }) {
  const parsed = parseThemeColor({ color, theme });
  if (!parsed.isThemeColor) {
    return color;
  }
  if (parsed.shade === void 0) {
    return `var(--mantine-color-${parsed.color}-${defaultShade})`;
  }
  return `var(${parsed.variable})`;
}

export { getMarkColor };
//# sourceMappingURL=get-mark-color.mjs.map
