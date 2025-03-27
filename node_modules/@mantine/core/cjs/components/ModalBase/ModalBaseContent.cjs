'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var cx = require('clsx');
var FocusTrap = require('../FocusTrap/FocusTrap.cjs');
var Paper = require('../Paper/Paper.cjs');
var Transition = require('../Transition/Transition.cjs');
var ModalBase_context = require('./ModalBase.context.cjs');
var ModalBase_module = require('./ModalBase.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const ModalBaseContent = React.forwardRef(
  ({ transitionProps, className, innerProps, onKeyDown, style, ...others }, ref) => {
    const ctx = ModalBase_context.useModalBaseContext();
    return /* @__PURE__ */ jsxRuntime.jsx(
      Transition.Transition,
      {
        mounted: ctx.opened,
        transition: "pop",
        ...ctx.transitionProps,
        onExited: () => {
          ctx.onExitTransitionEnd?.();
          ctx.transitionProps?.onExited?.();
        },
        onEntered: () => {
          ctx.onEnterTransitionEnd?.();
          ctx.transitionProps?.onEntered?.();
        },
        ...transitionProps,
        children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...innerProps,
            className: cx__default.default({ [ModalBase_module.inner]: !ctx.unstyled }, innerProps.className),
            children: /* @__PURE__ */ jsxRuntime.jsx(FocusTrap.FocusTrap, { active: ctx.opened && ctx.trapFocus, innerRef: ref, children: /* @__PURE__ */ jsxRuntime.jsx(
              Paper.Paper,
              {
                ...others,
                component: "section",
                role: "dialog",
                tabIndex: -1,
                "aria-modal": true,
                "aria-describedby": ctx.bodyMounted ? ctx.getBodyId() : void 0,
                "aria-labelledby": ctx.titleMounted ? ctx.getTitleId() : void 0,
                style: [style, transitionStyles],
                className: cx__default.default({ [ModalBase_module.content]: !ctx.unstyled }, className),
                unstyled: ctx.unstyled,
                children: others.children
              }
            ) })
          }
        )
      }
    );
  }
);
ModalBaseContent.displayName = "@mantine/core/ModalBaseContent";

exports.ModalBaseContent = ModalBaseContent;
//# sourceMappingURL=ModalBaseContent.cjs.map
