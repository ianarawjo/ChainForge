'use client';
'use strict';

var keys = require('../../../../core/utils/keys/keys.cjs');
var rem = require('../../../../core/utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
var getSortedBreakpoints = require('../../../../core/utils/get-sorted-breakpoints/get-sorted-breakpoints.cjs');
require('@mantine/hooks');
require('clsx');
require('../../../../core/MantineProvider/Mantine.context.cjs');
require('../../../../core/MantineProvider/default-theme.cjs');
require('../../../../core/MantineProvider/MantineProvider.cjs');
require('../../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../../core/Box/Box.cjs');
require('../../../../core/DirectionProvider/DirectionProvider.cjs');
var assignAsideVariables = require('../assign-aside-variables/assign-aside-variables.cjs');
var assignFooterVariables = require('../assign-footer-variables/assign-footer-variables.cjs');
var assignHeaderVariables = require('../assign-header-variables/assign-header-variables.cjs');
var assignNavbarVariables = require('../assign-navbar-variables/assign-navbar-variables.cjs');
var assignPaddingVariables = require('../assign-padding-variables/assign-padding-variables.cjs');

function getVariables({ navbar, header, footer, aside, padding, theme }) {
  const minMediaStyles = {};
  const maxMediaStyles = {};
  const baseStyles = {};
  assignNavbarVariables.assignNavbarVariables({
    baseStyles,
    minMediaStyles,
    maxMediaStyles,
    navbar,
    theme
  });
  assignAsideVariables.assignAsideVariables({
    baseStyles,
    minMediaStyles,
    maxMediaStyles,
    aside,
    theme
  });
  assignHeaderVariables.assignHeaderVariables({ baseStyles, minMediaStyles, header });
  assignFooterVariables.assignFooterVariables({ baseStyles, minMediaStyles, footer });
  assignPaddingVariables.assignPaddingVariables({ baseStyles, minMediaStyles, padding });
  const minMedia = getSortedBreakpoints.getSortedBreakpoints(keys.keys(minMediaStyles), theme.breakpoints).map(
    (breakpoint) => ({
      query: `(min-width: ${rem.em(breakpoint.px)})`,
      styles: minMediaStyles[breakpoint.value]
    })
  );
  const maxMedia = getSortedBreakpoints.getSortedBreakpoints(keys.keys(maxMediaStyles), theme.breakpoints).map(
    (breakpoint) => ({
      query: `(max-width: ${rem.em(breakpoint.px)})`,
      styles: maxMediaStyles[breakpoint.value]
    })
  );
  const media = [...minMedia, ...maxMedia];
  return { baseStyles, media };
}

exports.getVariables = getVariables;
//# sourceMappingURL=get-variables.cjs.map
