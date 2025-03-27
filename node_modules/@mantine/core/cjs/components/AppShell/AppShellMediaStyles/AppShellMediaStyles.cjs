'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
var Mantine_context = require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var InlineStyles = require('../../../core/InlineStyles/InlineStyles.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var getVariables = require('./get-variables/get-variables.cjs');

function AppShellMediaStyles({
  navbar,
  header,
  aside,
  footer,
  padding
}) {
  const theme = MantineThemeProvider.useMantineTheme();
  const ctx = Mantine_context.useMantineContext();
  const { media, baseStyles } = getVariables.getVariables({ navbar, header, footer, aside, padding, theme });
  return /* @__PURE__ */ jsxRuntime.jsx(InlineStyles.InlineStyles, { media, styles: baseStyles, selector: ctx.cssVariablesSelector });
}

exports.AppShellMediaStyles = AppShellMediaStyles;
//# sourceMappingURL=AppShellMediaStyles.cjs.map
