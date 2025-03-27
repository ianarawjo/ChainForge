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
var Menu_context = require('../Menu.context.cjs');
var Menu_module = require('../Menu.module.css.cjs');

const defaultProps = {};
const MenuLabel = factory.factory((props, ref) => {
  const { classNames, className, style, styles, vars, ...others } = useProps.useProps(
    "MenuLabel",
    defaultProps,
    props
  );
  const ctx = Menu_context.useMenuContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      ...ctx.getStyles("label", { className, style, styles, classNames }),
      ...others
    }
  );
});
MenuLabel.classes = Menu_module;
MenuLabel.displayName = "@mantine/core/MenuLabel";

exports.MenuLabel = MenuLabel;
//# sourceMappingURL=MenuLabel.cjs.map
