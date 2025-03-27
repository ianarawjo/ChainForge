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
require('../ModalBase/ModalBaseCloseButton.cjs');
require('../ModalBase/ModalBaseContent.cjs');
require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
var ModalBaseTitle = require('../ModalBase/ModalBaseTitle.cjs');
var Drawer_context = require('./Drawer.context.cjs');
var Drawer_module = require('./Drawer.module.css.cjs');

const defaultProps = {};
const DrawerTitle = factory.factory((_props, ref) => {
  const props = useProps.useProps("DrawerTitle", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = Drawer_context.useDrawerContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseTitle.ModalBaseTitle,
    {
      ref,
      ...ctx.getStyles("title", { classNames, style, styles, className }),
      ...others
    }
  );
});
DrawerTitle.classes = Drawer_module;
DrawerTitle.displayName = "@mantine/core/DrawerTitle";

exports.DrawerTitle = DrawerTitle;
//# sourceMappingURL=DrawerTitle.cjs.map
