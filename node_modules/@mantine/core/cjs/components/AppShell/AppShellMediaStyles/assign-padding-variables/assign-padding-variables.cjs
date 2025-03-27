'use client';
'use strict';

var keys = require('../../../../core/utils/keys/keys.cjs');
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
var getPaddingValue = require('../get-padding-value/get-padding-value.cjs');
var isPrimitiveSize = require('../is-primitive-size/is-primitive-size.cjs');
var isResponsiveSize = require('../is-responsive-size/is-responsive-size.cjs');

function assignPaddingVariables({
  padding,
  baseStyles,
  minMediaStyles
}) {
  if (isPrimitiveSize.isPrimitiveSize(padding)) {
    baseStyles["--app-shell-padding"] = getPaddingValue.getPaddingValue(getBaseSize.getBaseSize(padding));
  }
  if (isResponsiveSize.isResponsiveSize(padding)) {
    if (padding.base) {
      baseStyles["--app-shell-padding"] = getPaddingValue.getPaddingValue(padding.base);
    }
    keys.keys(padding).forEach((key) => {
      if (key !== "base") {
        minMediaStyles[key] = minMediaStyles[key] || {};
        minMediaStyles[key]["--app-shell-padding"] = getPaddingValue.getPaddingValue(padding[key]);
      }
    });
  }
}

exports.assignPaddingVariables = assignPaddingVariables;
//# sourceMappingURL=assign-padding-variables.cjs.map
