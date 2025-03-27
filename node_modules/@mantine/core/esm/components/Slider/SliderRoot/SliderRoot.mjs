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
import { useSliderContext } from '../Slider.context.mjs';

const SliderRoot = forwardRef(
  ({ size, disabled, variant, color, thumbSize, radius, ...others }, ref) => {
    const { getStyles } = useSliderContext();
    return /* @__PURE__ */ jsx(
      Box,
      {
        tabIndex: -1,
        variant,
        size,
        ref,
        ...getStyles("root"),
        ...others
      }
    );
  }
);
SliderRoot.displayName = "@mantine/core/SliderRoot";

export { SliderRoot };
//# sourceMappingURL=SliderRoot.mjs.map
