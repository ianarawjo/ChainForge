'use client';
import { keys } from '../../../../core/utils/keys/keys.mjs';
import { rem } from '../../../../core/utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import 'clsx';
import '../../../../core/MantineProvider/Mantine.context.mjs';
import '../../../../core/MantineProvider/default-theme.mjs';
import '../../../../core/MantineProvider/MantineProvider.mjs';
import '../../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../../core/Box/Box.mjs';
import '../../../../core/DirectionProvider/DirectionProvider.mjs';
import { getBaseSize } from '../get-base-size/get-base-size.mjs';
import { isPrimitiveSize } from '../is-primitive-size/is-primitive-size.mjs';
import { isResponsiveSize } from '../is-responsive-size/is-responsive-size.mjs';

function assignFooterVariables({
  baseStyles,
  minMediaStyles,
  footer
}) {
  const footerHeight = footer?.height;
  const collapsedFooterTransform = "translateY(var(--app-shell-footer-height))";
  const shouldOffset = footer?.offset ?? true;
  if (isPrimitiveSize(footerHeight)) {
    const baseSize = rem(getBaseSize(footerHeight));
    baseStyles["--app-shell-footer-height"] = baseSize;
    if (shouldOffset) {
      baseStyles["--app-shell-footer-offset"] = baseSize;
    }
  }
  if (isResponsiveSize(footerHeight)) {
    if (typeof footerHeight.base !== "undefined") {
      baseStyles["--app-shell-footer-height"] = rem(footerHeight.base);
      if (shouldOffset) {
        baseStyles["--app-shell-footer-offset"] = rem(footerHeight.base);
      }
    }
    keys(footerHeight).forEach((key) => {
      if (key !== "base") {
        minMediaStyles[key] = minMediaStyles[key] || {};
        minMediaStyles[key]["--app-shell-footer-height"] = rem(footerHeight[key]);
        if (shouldOffset) {
          minMediaStyles[key]["--app-shell-footer-offset"] = rem(footerHeight[key]);
        }
      }
    });
  }
  if (footer?.collapsed) {
    baseStyles["--app-shell-footer-transform"] = collapsedFooterTransform;
    baseStyles["--app-shell-footer-offset"] = "0px !important";
  }
}

export { assignFooterVariables };
//# sourceMappingURL=assign-footer-variables.mjs.map
