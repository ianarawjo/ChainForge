'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import cx from 'clsx';
import '../CloseButton/CloseIcon.mjs';
import { CloseButton } from '../CloseButton/CloseButton.mjs';
import { useModalBaseContext } from './ModalBase.context.mjs';
import classes from './ModalBase.module.css.mjs';

const ModalBaseCloseButton = forwardRef(
  ({ className, onClick, ...others }, ref) => {
    const ctx = useModalBaseContext();
    return /* @__PURE__ */ jsx(
      CloseButton,
      {
        ref,
        ...others,
        onClick: (event) => {
          ctx.onClose();
          onClick?.(event);
        },
        className: cx({ [classes.close]: !ctx.unstyled }, className),
        unstyled: ctx.unstyled
      }
    );
  }
);
ModalBaseCloseButton.displayName = "@mantine/core/ModalBaseCloseButton";

export { ModalBaseCloseButton };
//# sourceMappingURL=ModalBaseCloseButton.mjs.map
