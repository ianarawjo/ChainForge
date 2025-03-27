'use client';
'use strict';

var resolveClassNames = require('../resolve-class-names/resolve-class-names.cjs');

function getThemeClassNames({
  themeName,
  theme,
  selector,
  props,
  stylesCtx
}) {
  return themeName.map(
    (n) => resolveClassNames.resolveClassNames({
      theme,
      classNames: theme.components[n]?.classNames,
      props,
      stylesCtx
    })?.[selector]
  );
}

exports.getThemeClassNames = getThemeClassNames;
//# sourceMappingURL=get-theme-class-names.cjs.map
