'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var rem = require('../../../core/utils/units-converters/rem.cjs');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var ColorSlider = require('../ColorSlider/ColorSlider.cjs');

const HueSlider = React.forwardRef((props, ref) => {
  const { value, onChange, onChangeEnd, color, ...others } = useProps.useProps("HueSlider", {}, props);
  return /* @__PURE__ */ jsxRuntime.jsx(
    ColorSlider.ColorSlider,
    {
      ...others,
      ref,
      value,
      onChange,
      onChangeEnd,
      maxValue: 360,
      thumbColor: `hsl(${value}, 100%, 50%)`,
      round: true,
      "data-hue": true,
      overlays: [
        {
          backgroundImage: "linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(170,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))"
        },
        {
          boxShadow: `rgba(0, 0, 0, .1) 0 0 0 ${rem.rem(1)} inset, rgb(0, 0, 0, .15) 0 0 ${rem.rem(
            4
          )} inset`
        }
      ]
    }
  );
});
HueSlider.displayName = "@mantine/core/HueSlider";

exports.HueSlider = HueSlider;
//# sourceMappingURL=HueSlider.cjs.map
