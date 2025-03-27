'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useEffect } from 'react';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { DrawerBody } from './DrawerBody.mjs';
import { DrawerCloseButton } from './DrawerCloseButton.mjs';
import { DrawerContent } from './DrawerContent.mjs';
import { DrawerHeader } from './DrawerHeader.mjs';
import { DrawerOverlay } from './DrawerOverlay.mjs';
import { DrawerRoot } from './DrawerRoot.mjs';
import { DrawerStack, useDrawerStackContext } from './DrawerStack.mjs';
import { DrawerTitle } from './DrawerTitle.mjs';
import classes from './Drawer.module.css.mjs';

const defaultProps = {
  closeOnClickOutside: true,
  withinPortal: true,
  lockScroll: true,
  trapFocus: true,
  returnFocus: true,
  closeOnEscape: true,
  keepMounted: false,
  zIndex: getDefaultZIndex("modal"),
  withOverlay: true,
  withCloseButton: true
};
const Drawer = factory((_props, ref) => {
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
  } = useProps("Drawer", defaultProps, _props);
  const ctx = useDrawerStackContext();
  const hasHeader = !!title || withCloseButton;
  const stackProps = ctx && stackId ? {
    closeOnEscape: ctx.currentId === stackId,
    trapFocus: ctx.currentId === stackId,
    zIndex: ctx.getZIndex(stackId)
  } : {};
  const overlayVisible = withOverlay === false ? false : stackId && ctx ? ctx.currentId === stackId : opened;
  useEffect(() => {
    if (ctx && stackId) {
      opened ? ctx.addModal(stackId, zIndex || getDefaultZIndex("modal")) : ctx.removeModal(stackId);
    }
  }, [opened, stackId, zIndex]);
  return /* @__PURE__ */ jsxs(
    DrawerRoot,
    {
      ref,
      opened,
      zIndex: ctx && stackId ? ctx.getZIndex(stackId) : zIndex,
      ...others,
      ...stackProps,
      children: [
        withOverlay && /* @__PURE__ */ jsx(
          DrawerOverlay,
          {
            visible: overlayVisible,
            transitionProps: ctx && stackId ? { duration: 0 } : void 0,
            ...overlayProps
          }
        ),
        /* @__PURE__ */ jsxs(DrawerContent, { __hidden: ctx && stackId && opened ? stackId !== ctx.currentId : false, children: [
          hasHeader && /* @__PURE__ */ jsxs(DrawerHeader, { children: [
            title && /* @__PURE__ */ jsx(DrawerTitle, { children: title }),
            withCloseButton && /* @__PURE__ */ jsx(DrawerCloseButton, { ...closeButtonProps })
          ] }),
          /* @__PURE__ */ jsx(DrawerBody, { children })
        ] })
      ]
    }
  );
});
Drawer.classes = classes;
Drawer.displayName = "@mantine/core/Drawer";
Drawer.Root = DrawerRoot;
Drawer.Overlay = DrawerOverlay;
Drawer.Content = DrawerContent;
Drawer.Body = DrawerBody;
Drawer.Header = DrawerHeader;
Drawer.Title = DrawerTitle;
Drawer.CloseButton = DrawerCloseButton;
Drawer.Stack = DrawerStack;

export { Drawer };
//# sourceMappingURL=Drawer.mjs.map
