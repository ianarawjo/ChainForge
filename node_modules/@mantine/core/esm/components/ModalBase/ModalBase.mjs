'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import { getShadow, getSpacing } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../Portal/Portal.mjs';
import { OptionalPortal } from '../Portal/OptionalPortal.mjs';
import { ModalBaseProvider } from './ModalBase.context.mjs';
import { useModal } from './use-modal.mjs';

const ModalBase = forwardRef(
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
    const { _id, titleMounted, bodyMounted, shouldLockScroll, setTitleMounted, setBodyMounted } = useModal({ id, transitionProps, opened, trapFocus, closeOnEscape, onClose, returnFocus });
    const { key: removeScrollKey, ...otherRemoveScrollProps } = removeScrollProps || {};
    return /* @__PURE__ */ jsx(OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsx(
      ModalBaseProvider,
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
        children: /* @__PURE__ */ jsx(
          RemoveScroll,
          {
            enabled: shouldLockScroll && lockScroll,
            ...otherRemoveScrollProps,
            children: /* @__PURE__ */ jsx(
              Box,
              {
                ref,
                ...others,
                __vars: {
                  ...__vars,
                  "--mb-z-index": (zIndex || getDefaultZIndex("modal")).toString(),
                  "--mb-shadow": getShadow(shadow),
                  "--mb-padding": getSpacing(padding)
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

export { ModalBase };
//# sourceMappingURL=ModalBase.mjs.map
