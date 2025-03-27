'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Marks = require('../Marks/Marks.cjs');
var Slider_context = require('../Slider.context.cjs');

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
  const { getStyles } = Slider_context.useSliderContext();
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...getStyles("trackContainer"), mod: { disabled }, ...containerProps, children: /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ...getStyles("track"), mod: { inverted, disabled }, children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
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
    /* @__PURE__ */ jsxRuntime.jsx(Marks.Marks, { ...others, offset: marksOffset, disabled, inverted })
  ] }) });
}
Track.displayName = "@mantine/core/SliderTrack";

exports.Track = Track;
//# sourceMappingURL=Track.cjs.map
