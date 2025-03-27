'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var reactRemoveScroll = require('react-remove-scroll');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../Portal/Portal.cjs');
var OptionalPortal = require('../Portal/OptionalPortal.cjs');
var ModalBase_context = require('./ModalBase.context.cjs');
var useModal = require('./use-modal.cjs');

const ModalBase = React.forwardRef(
  ({
    keepMounted,
    opened,
    onClose,
    id,
    transitionProps,
    onExitTransitionEnd,
    onEnterTransitionEnd,
    trapFocus,
    closeOnEscape,
    returnFocus,
    closeOnClickOutside,
    withinPortal,
    portalProps,
    lockScroll,
    children,
    zIndex,
    shadow,
    padding,
    __vars,
    unstyled,
    removeScrollProps,
    ...others
  }, ref) => {
    const { _id, titleMounted, bodyMounted, shouldLockScroll, setTitleMounted, setBodyMounted } = useModal.useModal({ id, transitionProps, opened, trapFocus, closeOnEscape, onClose, returnFocus });
    const { key: removeScrollKey, ...otherRemoveScrollProps } = removeScrollProps || {};
    return /* @__PURE__ */ jsxRuntime.jsx(OptionalPortal.OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsxRuntime.jsx(
      ModalBase_context.ModalBaseProvider,
      {
        value: {
          opened,
          onClose,
          closeOnClickOutside,
          onExitTransitionEnd,
          onEnterTransitionEnd,
          transitionProps: { ...transitionProps, keepMounted },
          getTitleId: () => `${_id}-title`,
          getBodyId: () => `${_id}-body`,
          titleMounted,
          bodyMounted,
          setTitleMounted,
          setBodyMounted,
          trapFocus,
          closeOnEscape,
          zIndex,
          unstyled
        },
        children: /* @__PURE__ */ jsxRuntime.jsx(
          reactRemoveScroll.RemoveScroll,
          {
            enabled: shouldLockScroll && lockScroll,
            ...otherRemoveScrollProps,
            children: /* @__PURE__ */ jsxRuntime.jsx(
              Box.Box,
              {
                ref,
                ...others,
                __vars: {
                  ...__vars,
                  "--mb-z-index": (zIndex || getDefaultZIndex.getDefaultZIndex("modal")).toString(),
                  "--mb-shadow": getSize.getShadow(shadow),
                  "--mb-padding": getSize.getSpacing(padding)
                },
                children
              }
            )
          },
          removeScrollKey
        )
      }
    ) });
  }
);
ModalBase.displayName = "@mantine/core/ModalBase";

exports.ModalBase = ModalBase;
//# sourceMappingURL=ModalBase.cjs.map
