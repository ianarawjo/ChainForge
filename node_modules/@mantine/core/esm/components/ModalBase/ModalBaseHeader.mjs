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
import classes from './ModalBase.module.css.mjs';

const ModalBaseHeader = forwardRef(
  ({ className, ...others }, ref) => {
    const ctx = useModalBaseContext();
    return /* @__PURE__ */ jsx(
      Box,
      {
        component: "header",
        ref,
        className: cx({ [classes.header]: !ctx.unstyled }, className),
        ...others
      }
    );
  }
);
ModalBaseHeader.displayName = "@mantine/core/ModalBaseHeader";

export { ModalBaseHeader };
//# sourceMappingURL=ModalBaseHeader.mjs.map
