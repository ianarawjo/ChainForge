'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { Overlay } from '../Overlay/Overlay.mjs';
import { Transition } from '../Transition/Transition.mjs';
import { useModalBaseContext } from './ModalBase.context.mjs';
import { useModalTransition } from './use-modal-transition.mjs';

const ModalBaseOverlay = forwardRef(
  ({ onClick, transitionProps, style, visible, ...others }, ref) => {
    const ctx = useModalBaseContext();
    const transition = useModalTransition(transitionProps);
    return /* @__PURE__ */ jsx(
      Transition,
      {
        mounted: visible !== void 0 ? visible : ctx.opened,
        ...transition,
        transition: "fade",
        children: (transitionStyles) => /* @__PURE__ */ jsx(
          Overlay,
          {
            ref,
            fixed: true,
            style: [style, transitionStyles],
            zIndex: ctx.zIndex,
            unstyled: ctx.unstyled,
            onClick: (event) => {
              onClick?.(event);
              ctx.closeOnClickOutside && ctx.onClose();
            },
            ...others
          }
        )
      }
    );
  }
);
ModalBaseOverlay.displayName = "@mantine/core/ModalBaseOverlay";

export { ModalBaseOverlay };
//# sourceMappingURL=ModalBaseOverlay.mjs.map
