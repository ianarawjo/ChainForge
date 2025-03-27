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
var polymorphicFactory = require('../../../core/factory/polymorphic-factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var AppShell_context = require('../AppShell.context.cjs');
var AppShell_module = require('../AppShell.module.css.cjs');

const defaultProps = {};
const AppShellSection = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("AppShellSection", defaultProps, _props);
  const { classNames, className, style, styles, vars, grow, mod, ...others } = props;
  const ctx = AppShell_context.useAppShellContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      mod: [{ grow }, mod],
      ...ctx.getStyles("section", { className, style, classNames, styles }),
      ...others
    }
  );
});
AppShellSection.classes = AppShell_module;
AppShellSection.displayName = "@mantine/core/AppShellSection";

exports.AppShellSection = AppShellSection;
//# sourceMappingURL=AppShellSection.cjs.map
