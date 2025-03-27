'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import cx from 'clsx';
import '@mantine/hooks';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { useModalBaseContext } from './ModalBase.context.mjs';
import { useModalTitle } from './use-modal-title-id.mjs';
import classes from './ModalBase.module.css.mjs';

const ModalBaseTitle = forwardRef(
  ({ className, ...others }, ref) => {
    const id = useModalTitle();
    const ctx = useModalBaseContext();
    return /* @__PURE__ */ jsx(
      Box,
      {
        component: "h2",
        ref,
        className: cx({ [classes.title]: !ctx.unstyled }, className),
        ...others,
        id
      }
    );
  }
);
ModalBaseTitle.displayName = "@mantine/core/ModalBaseTitle";

export { ModalBaseTitle };
//# sourceMappingURL=ModalBaseTitle.mjs.map
