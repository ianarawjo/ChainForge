'use client';
'use strict';

var resolveStyles = require('../resolve-styles/resolve-styles.cjs');

function getThemeStyles({
  theme,
  themeName,
  props,
  stylesCtx,
  selector
}) {
  return themeName.map(
    (n) => resolveStyles.resolveStyles({
      theme,
      styles: theme.components[n]?.styles,
      props,
      stylesCtx
    })[selector]
  ).reduce((acc, val) => ({ ...acc, ...val }), {});
}

exports.getThemeStyles = getThemeStyles;
//# sourceMappingURL=get-theme-styles.cjs.map
