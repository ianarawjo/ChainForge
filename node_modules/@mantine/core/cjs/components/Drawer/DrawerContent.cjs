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
var ModalBaseContent = require('../ModalBase/ModalBaseContent.cjs');
require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
require('../ModalBase/ModalBaseTitle.cjs');
var NativeScrollArea = require('../ModalBase/NativeScrollArea.cjs');
var Drawer_context = require('./Drawer.context.cjs');
var Drawer_module = require('./Drawer.module.css.cjs');

const defaultProps = {};
const DrawerContent = factory.factory((_props, ref) => {
  const props = useProps.useProps("DrawerContent", defaultProps, _props);
  const { classNames, className, style, styles, vars, children, radius, __hidden, ...others } = props;
  const ctx = Drawer_context.useDrawerContext();
  const Scroll = ctx.scrollAreaComponent || NativeScrollArea.NativeScrollArea;
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseContent.ModalBaseContent,
    {
      ...ctx.getStyles("content", { className, style, styles, classNames }),
      innerProps: ctx.getStyles("inner", { className, style, styles, classNames }),
      ref,
      ...others,
      radius: radius || ctx.radius || 0,
      "data-hidden": __hidden || void 0,
      children: /* @__PURE__ */ jsxRuntime.jsx(Scroll, { style: { height: "calc(100vh - var(--drawer-offset) * 2)" }, children })
    }
  );
});
DrawerContent.classes = Drawer_module;
DrawerContent.displayName = "@mantine/core/DrawerContent";

exports.DrawerContent = DrawerContent;
//# sourceMappingURL=DrawerContent.cjs.map
