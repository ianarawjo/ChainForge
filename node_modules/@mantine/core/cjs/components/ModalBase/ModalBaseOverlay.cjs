'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var Overlay = require('../Overlay/Overlay.cjs');
var Transition = require('../Transition/Transition.cjs');
var ModalBase_context = require('./ModalBase.context.cjs');
var useModalTransition = require('./use-modal-transition.cjs');

const ModalBaseOverlay = React.forwardRef(
  ({ onClick, transitionProps, style, visible, ...others }, ref) => {
    const ctx = ModalBase_context.useModalBaseContext();
    const transition = useModalTransition.useModalTransition(transitionProps);
    return /* @__PURE__ */ jsxRuntime.jsx(
      Transition.Transition,
      {
        mounted: visible !== void 0 ? visible : ctx.opened,
        ...transition,
        transition: "fade",
        children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx(
          Overlay.Overlay,
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

exports.ModalBaseOverlay = ModalBaseOverlay;
//# sourceMappingURL=ModalBaseOverlay.cjs.map
