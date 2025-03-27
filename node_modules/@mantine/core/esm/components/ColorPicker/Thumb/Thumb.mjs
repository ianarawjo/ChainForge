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
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';

const Thumb = forwardRef(({ position, ...others }, ref) => /* @__PURE__ */ jsx(
  Box,
  {
    ref,
    __vars: {
      "--thumb-y-offset": `${position.y * 100}%`,
      "--thumb-x-offset": `${position.x * 100}%`
    },
    ...others
  }
));
Thumb.displayName = "@mantine/core/ColorPickerThumb";

export { Thumb };
//# sourceMappingURL=Thumb.mjs.map
