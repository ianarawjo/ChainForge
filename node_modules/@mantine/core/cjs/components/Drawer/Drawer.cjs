'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
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
var DrawerBody = require('./DrawerBody.cjs');
var DrawerCloseButton = require('./DrawerCloseButton.cjs');
var DrawerContent = require('./DrawerContent.cjs');
var DrawerHeader = require('./DrawerHeader.cjs');
var DrawerOverlay = require('./DrawerOverlay.cjs');
var DrawerRoot = require('./DrawerRoot.cjs');
var DrawerStack = require('./DrawerStack.cjs');
var DrawerTitle = require('./DrawerTitle.cjs');
var Drawer_module = require('./Drawer.module.css.cjs');

const defaultProps = {
  closeOnClickOutside: true,
  withinPortal: true,
  lockScroll: true,
  trapFocus: true,
  returnFocus: true,
  closeOnEscape: true,
  keepMounted: false,
  zIndex: getDefaultZIndex.getDefaultZIndex("modal"),
  withOverlay: true,
  withCloseButton: true
};
const Drawer = factory.factory((_props, ref) => {
  const {
    title,
    withOverlay,
    overlayProps,
    withCloseButton,
    closeButtonProps,
    children,
    opened,
    stackId,
    zIndex,
    ...others
  } = useProps.useProps("Drawer", defaultProps, _props);
  const ctx = DrawerStack.useDrawerStackContext();
  const hasHeader = !!title || withCloseButton;
  const stackProps = ctx && stackId ? {
    closeOnEscape: ctx.currentId === stackId,
    trapFocus: ctx.currentId === stackId,
    zIndex: ctx.getZIndex(stackId)
  } : {};
  const overlayVisible = withOverlay === false ? false : stackId && ctx ? ctx.currentId === stackId : opened;
  React.useEffect(() => {
    if (ctx && stackId) {
      opened ? ctx.addModal(stackId, zIndex || getDefaultZIndex.getDefaultZIndex("modal")) : ctx.removeModal(stackId);
    }
  }, [opened, stackId, zIndex]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    DrawerRoot.DrawerRoot,
    {
      ref,
      opened,
      zIndex: ctx && stackId ? ctx.getZIndex(stackId) : zIndex,
      ...others,
      ...stackProps,
      children: [
        withOverlay && /* @__PURE__ */ jsxRuntime.jsx(
          DrawerOverlay.DrawerOverlay,
          {
            visible: overlayVisible,
            transitionProps: ctx && stackId ? { duration: 0 } : void 0,
            ...overlayProps
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsxs(DrawerContent.DrawerContent, { __hidden: ctx && stackId && opened ? stackId !== ctx.currentId : false, children: [
          hasHeader && /* @__PURE__ */ jsxRuntime.jsxs(DrawerHeader.DrawerHeader, { children: [
            title && /* @__PURE__ */ jsxRuntime.jsx(DrawerTitle.DrawerTitle, { children: title }),
            withCloseButton && /* @__PURE__ */ jsxRuntime.jsx(DrawerCloseButton.DrawerCloseButton, { ...closeButtonProps })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(DrawerBody.DrawerBody, { children })
        ] })
      ]
    }
  );
});
Drawer.classes = Drawer_module;
Drawer.displayName = "@mantine/core/Drawer";
Drawer.Root = DrawerRoot.DrawerRoot;
Drawer.Overlay = DrawerOverlay.DrawerOverlay;
Drawer.Content = DrawerContent.DrawerContent;
Drawer.Body = DrawerBody.DrawerBody;
Drawer.Header = DrawerHeader.DrawerHeader;
Drawer.Title = DrawerTitle.DrawerTitle;
Drawer.CloseButton = DrawerCloseButton.DrawerCloseButton;
Drawer.Stack = DrawerStack.DrawerStack;

exports.Drawer = Drawer;
//# sourceMappingURL=Drawer.cjs.map
