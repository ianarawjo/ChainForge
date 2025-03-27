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

function assignHeaderVariables({
  baseStyles,
  minMediaStyles,
  header
}) {
  const headerHeight = header?.height;
  const collapsedHeaderTransform = "translateY(calc(var(--app-shell-header-height) * -1))";
  const shouldOffset = header?.offset ?? true;
  if (isPrimitiveSize.isPrimitiveSize(headerHeight)) {
    const baseSize = rem.rem(getBaseSize.getBaseSize(headerHeight));
    baseStyles["--app-shell-header-height"] = baseSize;
    if (shouldOffset) {
      baseStyles["--app-shell-header-offset"] = baseSize;
    }
  }
  if (isResponsiveSize.isResponsiveSize(headerHeight)) {
    if (typeof headerHeight.base !== "undefined") {
      baseStyles["--app-shell-header-height"] = rem.rem(headerHeight.base);
      if (shouldOffset) {
        baseStyles["--app-shell-header-offset"] = rem.rem(headerHeight.base);
      }
    }
    keys.keys(headerHeight).forEach((key) => {
      if (key !== "base") {
        minMediaStyles[key] = minMediaStyles[key] || {};
        minMediaStyles[key]["--app-shell-header-height"] = rem.rem(headerHeight[key]);
        if (shouldOffset) {
          minMediaStyles[key]["--app-shell-header-offset"] = rem.rem(headerHeight[key]);
        }
      }
    });
  }
  if (header?.collapsed) {
    baseStyles["--app-shell-header-transform"] = collapsedHeaderTransform;
    baseStyles["--app-shell-header-offset"] = "0px !important";
  }
}

exports.assignHeaderVariables = assignHeaderVariables;
//# sourceMappingURL=assign-header-variables.cjs.map
