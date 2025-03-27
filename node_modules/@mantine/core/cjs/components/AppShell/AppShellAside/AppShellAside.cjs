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
const AppShellAside = factory.factory((_props, ref) => {
  const props = useProps.useProps("AppShellAside", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    withBorder,
    zIndex,
    mod,
    ...others
  } = props;
  const ctx = AppShell_context.useAppShellContext();
  if (ctx.disabled) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "aside",
      ref,
      mod: [{ "with-border": withBorder ?? ctx.withBorder }, mod],
      ...ctx.getStyles("aside", { className, classNames, styles, style }),
      ...others,
      __vars: {
        "--app-shell-aside-z-index": `calc(${zIndex ?? ctx.zIndex} + 1)`
      }
    }
  );
});
AppShellAside.classes = AppShell_module;
AppShellAside.displayName = "@mantine/core/AppShellAside";

exports.AppShellAside = AppShellAside;
//# sourceMappingURL=AppShellAside.cjs.map
