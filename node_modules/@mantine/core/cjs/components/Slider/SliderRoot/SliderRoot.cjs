'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Slider_context = require('../Slider.context.cjs');

const SliderRoot = React.forwardRef(
  ({ size, disabled, variant, color, thumbSize, radius, ...others }, ref) => {
    const { getStyles } = Slider_context.useSliderContext();
    return /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
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

exports.SliderRoot = SliderRoot;
//# sourceMappingURL=SliderRoot.cjs.map
