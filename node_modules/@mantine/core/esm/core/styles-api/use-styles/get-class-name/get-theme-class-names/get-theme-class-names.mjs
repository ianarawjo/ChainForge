'use client';
import { resolveClassNames } from '../resolve-class-names/resolve-class-names.mjs';

function getThemeClassNames({
  themeName,
  theme,
  selector,
  props,
  stylesCtx
}) {
  return themeName.map(
    (n) => resolveClassNames({
      theme,
      classNames: theme.components[n]?.classNames,
      props,
      stylesCtx
    })?.[selector]
  );
}

export { getThemeClassNames };
//# sourceMappingURL=get-theme-class-names.mjs.map
