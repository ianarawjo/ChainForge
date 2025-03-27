'use client';
import { getPrimaryShade } from '../get-primary-shade/get-primary-shade.mjs';
import { parseThemeColor } from '../parse-theme-color/parse-theme-color.mjs';

function getContrastColor({ color, theme, autoContrast }) {
  const _autoContrast = typeof autoContrast === "boolean" ? autoContrast : theme.autoContrast;
  if (!_autoContrast) {
    return "var(--mantine-color-white)";
  }
  const parsed = parseThemeColor({ color: color || theme.primaryColor, theme });
  return parsed.isLight ? "var(--mantine-color-black)" : "var(--mantine-color-white)";
}
function getPrimaryContrastColor(theme, colorScheme) {
  return getContrastColor({
    color: theme.colors[theme.primaryColor][getPrimaryShade(theme, colorScheme)],
    theme,
    autoContrast: null
  });
}

export { getContrastColor, getPrimaryContrastColor };
//# sourceMappingURL=get-contrast-color.mjs.map
