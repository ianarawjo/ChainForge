'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var cx = require('clsx');
var reactRemoveScroll = require('react-remove-scroll');
require('react');
require('@mantine/hooks');
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

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const defaultProps = {};
const AppShellHeader = factory.factory((_props, ref) => {
  const props = useProps.useProps("AppShellHeader", defaultProps, _props);
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
      component: "header",
      ref,
      mod: [{ "with-border": withBorder ?? ctx.withBorder }, mod],
      ...ctx.getStyles("header", {
        className: cx__default.default({ [reactRemoveScroll.RemoveScroll.classNames.zeroRight]: ctx.offsetScrollbars }, className),
        classNames,
        styles,
        style
      }),
      ...others,
      __vars: { "--app-shell-header-z-index": (zIndex ?? ctx.zIndex)?.toString() }
    }
  );
});
AppShellHeader.classes = AppShell_module;
AppShellHeader.displayName = "@mantine/core/AppShellHeader";

exports.AppShellHeader = AppShellHeader;
//# sourceMappingURL=AppShellHeader.cjs.map
