'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../ModalBase/ModalBase.cjs');
require('../ModalBase/ModalBaseBody.cjs');
var ModalBaseCloseButton = require('../ModalBase/ModalBaseCloseButton.cjs');
require('../ModalBase/ModalBaseContent.cjs');
require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
require('../ModalBase/ModalBaseTitle.cjs');
var Drawer_context = require('./Drawer.context.cjs');
var Drawer_module = require('./Drawer.module.css.cjs');

const defaultProps = {};
const DrawerCloseButton = factory.factory((_props, ref) => {
  const props = useProps.useProps("DrawerCloseButton", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = Drawer_context.useDrawerContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseCloseButton.ModalBaseCloseButton,
    {
      ref,
      ...ctx.getStyles("close", { classNames, style, styles, className }),
      ...others
    }
  );
});
DrawerCloseButton.classes = Drawer_module;
DrawerCloseButton.displayName = "@mantine/core/DrawerCloseButton";

exports.DrawerCloseButton = DrawerCloseButton;
//# sourceMappingURL=DrawerCloseButton.cjs.map
