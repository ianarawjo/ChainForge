'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import cx from 'clsx';
import { FocusTrap } from '../FocusTrap/FocusTrap.mjs';
import { Paper } from '../Paper/Paper.mjs';
import { Transition } from '../Transition/Transition.mjs';
import { useModalBaseContext } from './ModalBase.context.mjs';
import classes from './ModalBase.module.css.mjs';

const ModalBaseContent = forwardRef(
  ({ transitionProps, className, innerProps, onKeyDown, style, ...others }, ref) => {
    const ctx = useModalBaseContext();
    return /* @__PURE__ */ jsx(
      Transition,
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
        children: (transitionStyles) => /* @__PURE__ */ jsx(
          "div",
          {
            ...innerProps,
            className: cx({ [classes.inner]: !ctx.unstyled }, innerProps.className),
            children: /* @__PURE__ */ jsx(FocusTrap, { active: ctx.opened && ctx.trapFocus, innerRef: ref, children: /* @__PURE__ */ jsx(
              Paper,
              {
                ...others,
                component: "section",
                role: "dialog",
                tabIndex: -1,
                "aria-modal": true,
                "aria-describedby": ctx.bodyMounted ? ctx.getBodyId() : void 0,
                "aria-labelledby": ctx.titleMounted ? ctx.getTitleId() : void 0,
                style: [style, transitionStyles],
                className: cx({ [classes.content]: !ctx.unstyled }, className),
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

export { ModalBaseContent };
//# sourceMappingURL=ModalBaseContent.mjs.map
