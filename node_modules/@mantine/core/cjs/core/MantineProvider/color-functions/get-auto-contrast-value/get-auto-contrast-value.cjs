'use client';
'use strict';

function getAutoContrastValue(autoContrast, theme) {
  return typeof autoContrast === "boolean" ? autoContrast : theme.autoContrast;
}

exports.getAutoContrastValue = getAutoContrastValue;
//# sourceMappingURL=get-auto-contrast-value.cjs.map
