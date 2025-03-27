'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { useDirection } from '../../../core/DirectionProvider/DirectionProvider.mjs';
import { getArrowPositionStyles } from './get-arrow-position-styles.mjs';

const FloatingArrow = forwardRef(
  ({
    position,
    arrowSize,
    arrowOffset,
    arrowRadius,
    arrowPosition,
    visible,
    arrowX,
    arrowY,
    style,
    ...others
  }, ref) => {
    const { dir } = useDirection();
    if (!visible) {
      return null;
    }
    return /* @__PURE__ */ jsx(
      "div",
      {
        ...others,
        ref,
        style: {
          ...style,
          ...getArrowPositionStyles({
            position,
            arrowSize,
            arrowOffset,
            arrowRadius,
            arrowPosition,
            dir,
            arrowX,
            arrowY
          })
        }
      }
    );
  }
);
FloatingArrow.displayName = "@mantine/core/FloatingArrow";

export { FloatingArrow };
//# sourceMappingURL=FloatingArrow.mjs.map
