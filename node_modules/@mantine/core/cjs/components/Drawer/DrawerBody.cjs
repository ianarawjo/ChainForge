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
var ModalBaseBody = require('../ModalBase/ModalBaseBody.cjs');
require('../ModalBase/ModalBaseCloseButton.cjs');
require('../ModalBase/ModalBaseContent.cjs');
require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
require('../ModalBase/ModalBaseTitle.cjs');
var Drawer_context = require('./Drawer.context.cjs');
var Drawer_module = require('./Drawer.module.css.cjs');

const defaultProps = {};
const DrawerBody = factory.factory((_props, ref) => {
  const props = useProps.useProps("DrawerBody", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = Drawer_context.useDrawerContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseBody.ModalBaseBody,
    {
      ref,
      ...ctx.getStyles("body", { classNames, style, styles, className }),
      ...others
    }
  );
});
DrawerBody.classes = Drawer_module;
DrawerBody.displayName = "@mantine/core/DrawerBody";

exports.DrawerBody = DrawerBody;
//# sourceMappingURL=DrawerBody.cjs.map
