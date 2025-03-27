'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Marks } from '../Marks/Marks.mjs';
import { useSliderContext } from '../Slider.context.mjs';

function Track({
  filled,
  children,
  offset,
  disabled,
  marksOffset,
  inverted,
  containerProps,
  ...others
}) {
  const { getStyles } = useSliderContext();
  return /* @__PURE__ */ jsx(Box, { ...getStyles("trackContainer"), mod: { disabled }, ...containerProps, children: /* @__PURE__ */ jsxs(Box, { ...getStyles("track"), mod: { inverted, disabled }, children: [
    /* @__PURE__ */ jsx(
      Box,
      {
        mod: { inverted, disabled },
        __vars: {
          "--slider-bar-width": `calc(${filled}% + var(--slider-size))`,
          "--slider-bar-offset": `calc(${offset}% - var(--slider-size))`
        },
        ...getStyles("bar")
      }
    ),
    children,
    /* @__PURE__ */ jsx(Marks, { ...others, offset: marksOffset, disabled, inverted })
  ] }) });
}
Track.displayName = "@mantine/core/SliderTrack";

export { Track };
//# sourceMappingURL=Track.mjs.map
