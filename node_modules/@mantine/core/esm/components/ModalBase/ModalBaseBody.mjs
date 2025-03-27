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
import { useModalBodyId } from './use-modal-body-id.mjs';
import classes from './ModalBase.module.css.mjs';

const ModalBaseBody = forwardRef(
  ({ className, ...others }, ref) => {
    const bodyId = useModalBodyId();
    const ctx = useModalBaseContext();
    return /* @__PURE__ */ jsx(
      Box,
      {
        ref,
        ...others,
        id: bodyId,
        className: cx({ [classes.body]: !ctx.unstyled }, className)
      }
    );
  }
);
ModalBaseBody.displayName = "@mantine/core/ModalBaseBody";

export { ModalBaseBody };
//# sourceMappingURL=ModalBaseBody.mjs.map
