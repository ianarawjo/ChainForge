'use client';
'use strict';

var keys = require('../../../../core/utils/keys/keys.cjs');
var rem = require('../../../../core/utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
require('clsx');
require('../../../../core/MantineProvider/Mantine.context.cjs');
require('../../../../core/MantineProvider/default-theme.cjs');
require('../../../../core/MantineProvider/MantineProvider.cjs');
require('../../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../../core/Box/Box.cjs');
require('../../../../core/DirectionProvider/DirectionProvider.cjs');
var getBaseSize = require('../get-base-size/get-base-size.cjs');
var isPrimitiveSize = require('../is-primitive-size/is-primitive-size.cjs');
var isResponsiveSize = require('../is-responsive-size/is-responsive-size.cjs');

function assignFooterVariables({
  baseStyles,
  minMediaStyles,
  footer
}) {
  const footerHeight = footer?.height;
  const collapsedFooterTransform = "translateY(var(--app-shell-footer-height))";
  const shouldOffset = footer?.offset ?? true;
  if (isPrimitiveSize.isPrimitiveSize(footerHeight)) {
    const baseSize = rem.rem(getBaseSize.getBaseSize(footerHeight));
    baseStyles["--app-shell-footer-height"] = baseSize;
    if (shouldOffset) {
      baseStyles["--app-shell-footer-offset"] = baseSize;
    }
  }
  if (isResponsiveSize.isResponsiveSize(footerHeight)) {
    if (typeof footerHeight.base !== "undefined") {
      baseStyles["--app-shell-footer-height"] = rem.rem(footerHeight.base);
      if (shouldOffset) {
        baseStyles["--app-shell-footer-offset"] = rem.rem(footerHeight.base);
      }
    }
    keys.keys(footerHeight).forEach((key) => {
      if (key !== "base") {
        minMediaStyles[key] = minMediaStyles[key] || {};
        minMediaStyles[key]["--app-shell-footer-height"] = rem.rem(footerHeight[key]);
        if (shouldOffset) {
          minMediaStyles[key]["--app-shell-footer-offset"] = rem.rem(footerHeight[key]);
        }
      }
    });
  }
  if (footer?.collapsed) {
    baseStyles["--app-shell-footer-transform"] = collapsedFooterTransform;
    baseStyles["--app-shell-footer-offset"] = "0px !important";
  }
}

exports.assignFooterVariables = assignFooterVariables;
//# sourceMappingURL=assign-footer-variables.cjs.map
