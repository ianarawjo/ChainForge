'use client';
'use strict';

function getPrimaryShade(theme, colorScheme) {
  if (typeof theme.primaryShade === "number") {
    return theme.primaryShade;
  }
  if (colorScheme === "dark") {
    return theme.primaryShade.dark;
  }
  return theme.primaryShade.light;
}

exports.getPrimaryShade = getPrimaryShade;
//# sourceMappingURL=get-primary-shade.cjs.map
