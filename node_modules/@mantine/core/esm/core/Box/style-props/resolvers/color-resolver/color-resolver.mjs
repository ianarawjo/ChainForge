'use client';
import { parseThemeColor } from '../../../../MantineProvider/color-functions/parse-theme-color/parse-theme-color.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import '../../../../MantineProvider/Mantine.context.mjs';
import '../../../../MantineProvider/default-theme.mjs';
import '../../../../MantineProvider/MantineProvider.mjs';
import '../../../../MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../../MantineProvider/MantineCssVariables/MantineCssVariables.mjs';

function colorResolver(color, theme) {
  const parsedColor = parseThemeColor({ color, theme });
  if (parsedColor.color === "dimmed") {
    return "var(--mantine-color-dimmed)";
  }
  if (parsedColor.color === "bright") {
    return "var(--mantine-color-bright)";
  }
  return parsedColor.variable ? `var(${parsedColor.variable})` : parsedColor.color;
}
function textColorResolver(color, theme) {
  const parsedColor = parseThemeColor({ color, theme });
  if (parsedColor.isThemeColor && parsedColor.shade === void 0) {
    return `var(--mantine-color-${parsedColor.color}-text)`;
  }
  return colorResolver(color, theme);
}

export { colorResolver, textColorResolver };
//# sourceMappingURL=color-resolver.mjs.map
