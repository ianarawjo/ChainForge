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
import { ModalBody } from './ModalBody.mjs';
import { ModalCloseButton } from './ModalCloseButton.mjs';
import { ModalContent } from './ModalContent.mjs';
import { ModalHeader } from './ModalHeader.mjs';
import { ModalOverlay } from './ModalOverlay.mjs';
import { ModalRoot } from './ModalRoot.mjs';
import { ModalStack, useModalStackContext } from './ModalStack.mjs';
import { ModalTitle } from './ModalTitle.mjs';
import classes from './Modal.module.css.mjs';

const defaultProps = {
  closeOnClickOutside: true,
  withinPortal: true,
  lockScroll: true,
  trapFocus: true,
  returnFocus: true,
  closeOnEscape: true,
  keepMounted: false,
  zIndex: getDefaultZIndex("modal"),
  transitionProps: { duration: 200, transition: "fade-down" },
  withOverlay: true,
  withCloseButton: true
};
const Modal = factory((_props, ref) => {
  const {
    title,
    withOverlay,
    overlayProps,
    withCloseButton,
    closeButtonProps,
    children,
    radius,
    opened,
    stackId,
    zIndex,
    ...others
  } = useProps("Modal", defaultProps, _props);
  const ctx = useModalStackContext();
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
    ModalRoot,
    {
      ref,
      radius,
      opened,
      zIndex: ctx && stackId ? ctx.getZIndex(stackId) : zIndex,
      ...others,
      ...stackProps,
      children: [
        withOverlay && /* @__PURE__ */ jsx(
          ModalOverlay,
          {
            visible: overlayVisible,
            transitionProps: ctx && stackId ? { duration: 0 } : void 0,
            ...overlayProps
          }
        ),
        /* @__PURE__ */ jsxs(
          ModalContent,
          {
            radius,
            __hidden: ctx && stackId && opened ? stackId !== ctx.currentId : false,
            children: [
              hasHeader && /* @__PURE__ */ jsxs(ModalHeader, { children: [
                title && /* @__PURE__ */ jsx(ModalTitle, { children: title }),
                withCloseButton && /* @__PURE__ */ jsx(ModalCloseButton, { ...closeButtonProps })
              ] }),
              /* @__PURE__ */ jsx(ModalBody, { children })
            ]
          }
        )
      ]
    }
  );
});
Modal.classes = classes;
Modal.displayName = "@mantine/core/Modal";
Modal.Root = ModalRoot;
Modal.Overlay = ModalOverlay;
Modal.Content = ModalContent;
Modal.Body = ModalBody;
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.CloseButton = ModalCloseButton;
Modal.Stack = ModalStack;

export { Modal };
//# sourceMappingURL=Modal.mjs.map
