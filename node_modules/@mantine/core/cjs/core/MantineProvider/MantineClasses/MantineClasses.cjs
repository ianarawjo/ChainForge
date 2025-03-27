'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var keys = require('../../utils/keys/keys.cjs');
var px = require('../../utils/units-converters/px.cjs');
var rem = require('../../utils/units-converters/rem.cjs');
require('react');
require('@mantine/hooks');
var Mantine_context = require('../Mantine.context.cjs');
var MantineThemeProvider = require('../MantineThemeProvider/MantineThemeProvider.cjs');

function MantineClasses() {
  const theme = MantineThemeProvider.useMantineTheme();
  const nonce = Mantine_context.useMantineStyleNonce();
  const classes = keys.keys(theme.breakpoints).reduce((acc, breakpoint) => {
    const isPxBreakpoint = theme.breakpoints[breakpoint].includes("px");
    const pxValue = px.px(theme.breakpoints[breakpoint]);
    const maxWidthBreakpoint = isPxBreakpoint ? `${pxValue - 0.1}px` : rem.em(pxValue - 0.1);
    const minWidthBreakpoint = isPxBreakpoint ? `${pxValue}px` : rem.em(pxValue);
    return `${acc}@media (max-width: ${maxWidthBreakpoint}) {.mantine-visible-from-${breakpoint} {display: none !important;}}@media (min-width: ${minWidthBreakpoint}) {.mantine-hidden-from-${breakpoint} {display: none !important;}}`;
  }, "");
  return /* @__PURE__ */ jsxRuntime.jsx(
    "style",
    {
      "data-mantine-styles": "classes",
      nonce: nonce?.(),
      dangerouslySetInnerHTML: { __html: classes }
    }
  );
}

exports.MantineClasses = MantineClasses;
//# sourceMappingURL=MantineClasses.cjs.map
