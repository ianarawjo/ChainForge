'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var AppShell_context = require('../AppShell.context.cjs');
var AppShell_module = require('../AppShell.module.css.cjs');

const defaultProps = {};
const AppShellMain = factory.factory((_props, ref) => {
  const props = useProps.useProps("AppShellMain", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = AppShell_context.useAppShellContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "main",
      ref,
      ...ctx.getStyles("main", { className, style, classNames, styles }),
      ...others
    }
  );
});
AppShellMain.classes = AppShell_module;
AppShellMain.displayName = "@mantine/core/AppShellMain";

exports.AppShellMain = AppShellMain;
//# sourceMappingURL=AppShellMain.cjs.map
