'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var AppShell_context = require('./AppShell.context.cjs');
var AppShellAside = require('./AppShellAside/AppShellAside.cjs');
var AppShellFooter = require('./AppShellFooter/AppShellFooter.cjs');
var AppShellHeader = require('./AppShellHeader/AppShellHeader.cjs');
var AppShellMain = require('./AppShellMain/AppShellMain.cjs');
var AppShellMediaStyles = require('./AppShellMediaStyles/AppShellMediaStyles.cjs');
var AppShellNavbar = require('./AppShellNavbar/AppShellNavbar.cjs');
var AppShellSection = require('./AppShellSection/AppShellSection.cjs');
var useResizing = require('./use-resizing/use-resizing.cjs');
var AppShell_module = require('./AppShell.module.css.cjs');

const defaultProps = {
  withBorder: true,
  padding: 0,
  transitionDuration: 200,
  transitionTimingFunction: "ease",
  zIndex: getDefaultZIndex.getDefaultZIndex("app")
};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { transitionDuration, transitionTimingFunction }) => ({
    root: {
      "--app-shell-transition-duration": `${transitionDuration}ms`,
      "--app-shell-transition-timing-function": transitionTimingFunction
    }
  })
);
const AppShell = factory.factory((_props, ref) => {
  const props = useProps.useProps("AppShell", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    navbar,
    withBorder,
    padding,
    transitionDuration,
    transitionTimingFunction,
    header,
    zIndex,
    layout,
    disabled,
    aside,
    footer,
    offsetScrollbars = layout !== "alt",
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "AppShell",
    classes: AppShell_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const resizing = useResizing.useResizing({ disabled, transitionDuration });
  return /* @__PURE__ */ jsxRuntime.jsxs(AppShell_context.AppShellProvider, { value: { getStyles, withBorder, zIndex, disabled, offsetScrollbars }, children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      AppShellMediaStyles.AppShellMediaStyles,
      {
        navbar,
        header,
        aside,
        footer,
        padding
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ref,
        ...getStyles("root"),
        mod: [{ resizing, layout, disabled }, mod],
        ...others
      }
    )
  ] });
});
AppShell.classes = AppShell_module;
AppShell.displayName = "@mantine/core/AppShell";
AppShell.Navbar = AppShellNavbar.AppShellNavbar;
AppShell.Header = AppShellHeader.AppShellHeader;
AppShell.Main = AppShellMain.AppShellMain;
AppShell.Aside = AppShellAside.AppShellAside;
AppShell.Footer = AppShellFooter.AppShellFooter;
AppShell.Section = AppShellSection.AppShellSection;

exports.AppShell = AppShell;
//# sourceMappingURL=AppShell.cjs.map
