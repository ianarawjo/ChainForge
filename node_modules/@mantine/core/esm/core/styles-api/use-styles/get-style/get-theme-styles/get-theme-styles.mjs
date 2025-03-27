'use client';
import { resolveStyles } from '../resolve-styles/resolve-styles.mjs';

function getThemeStyles({
  theme,
  themeName,
  props,
  stylesCtx,
  selector
}) {
  return themeName.map(
    (n) => resolveStyles({
      theme,
      styles: theme.components[n]?.styles,
      props,
      stylesCtx
    })[selector]
  ).reduce((acc, val) => ({ ...acc, ...val }), {});
}

export { getThemeStyles };
//# sourceMappingURL=get-theme-styles.mjs.map
