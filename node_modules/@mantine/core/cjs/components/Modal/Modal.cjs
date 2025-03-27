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
var ModalBody = require('./ModalBody.cjs');
var ModalCloseButton = require('./ModalCloseButton.cjs');
var ModalContent = require('./ModalContent.cjs');
var ModalHeader = require('./ModalHeader.cjs');
var ModalOverlay = require('./ModalOverlay.cjs');
var ModalRoot = require('./ModalRoot.cjs');
var ModalStack = require('./ModalStack.cjs');
var ModalTitle = require('./ModalTitle.cjs');
var Modal_module = require('./Modal.module.css.cjs');

const defaultProps = {
  closeOnClickOutside: true,
  withinPortal: true,
  lockScroll: true,
  trapFocus: true,
  returnFocus: true,
  closeOnEscape: true,
  keepMounted: false,
  zIndex: getDefaultZIndex.getDefaultZIndex("modal"),
  transitionProps: { duration: 200, transition: "fade-down" },
  withOverlay: true,
  withCloseButton: true
};
const Modal = factory.factory((_props, ref) => {
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
  } = useProps.useProps("Modal", defaultProps, _props);
  const ctx = ModalStack.useModalStackContext();
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
    ModalRoot.ModalRoot,
    {
      ref,
      radius,
      opened,
      zIndex: ctx && stackId ? ctx.getZIndex(stackId) : zIndex,
      ...others,
      ...stackProps,
      children: [
        withOverlay && /* @__PURE__ */ jsxRuntime.jsx(
          ModalOverlay.ModalOverlay,
          {
            visible: overlayVisible,
            transitionProps: ctx && stackId ? { duration: 0 } : void 0,
            ...overlayProps
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsxs(
          ModalContent.ModalContent,
          {
            radius,
            __hidden: ctx && stackId && opened ? stackId !== ctx.currentId : false,
            children: [
              hasHeader && /* @__PURE__ */ jsxRuntime.jsxs(ModalHeader.ModalHeader, { children: [
                title && /* @__PURE__ */ jsxRuntime.jsx(ModalTitle.ModalTitle, { children: title }),
                withCloseButton && /* @__PURE__ */ jsxRuntime.jsx(ModalCloseButton.ModalCloseButton, { ...closeButtonProps })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx(ModalBody.ModalBody, { children })
            ]
          }
        )
      ]
    }
  );
});
Modal.classes = Modal_module;
Modal.displayName = "@mantine/core/Modal";
Modal.Root = ModalRoot.ModalRoot;
Modal.Overlay = ModalOverlay.ModalOverlay;
Modal.Content = ModalContent.ModalContent;
Modal.Body = ModalBody.ModalBody;
Modal.Header = ModalHeader.ModalHeader;
Modal.Title = ModalTitle.ModalTitle;
Modal.CloseButton = ModalCloseButton.ModalCloseButton;
Modal.Stack = ModalStack.ModalStack;

exports.Modal = Modal;
//# sourceMappingURL=Modal.cjs.map
