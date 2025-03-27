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
var parsers = require('../converters/parsers.cjs');

const defaultProps = {};
const AlphaSlider = React.forwardRef((props, ref) => {
  const { value, onChange, onChangeEnd, color, ...others } = useProps.useProps(
    "AlphaSlider",
    defaultProps,
    props
  );
  return /* @__PURE__ */ jsxRuntime.jsx(
    ColorSlider.ColorSlider,
    {
      ...others,
      ref,
      value,
      onChange: (val) => onChange?.(parsers.round(val, 2)),
      onChangeEnd: (val) => onChangeEnd?.(parsers.round(val, 2)),
      maxValue: 1,
      round: false,
      "data-alpha": true,
      overlays: [
        {
          backgroundImage: "linear-gradient(45deg, var(--slider-checkers) 25%, transparent 25%), linear-gradient(-45deg, var(--slider-checkers) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--slider-checkers) 75%), linear-gradient(-45deg, var(--mantine-color-body) 75%, var(--slider-checkers) 75%)",
          backgroundSize: `${rem.rem(8)} ${rem.rem(8)}`,
          backgroundPosition: `0 0, 0 ${rem.rem(4)}, ${rem.rem(4)} ${rem.rem(-4)}, ${rem.rem(-4)} 0`
        },
        {
          backgroundImage: `linear-gradient(90deg, transparent, ${color})`
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
AlphaSlider.displayName = "@mantine/core/AlphaSlider";

exports.AlphaSlider = AlphaSlider;
//# sourceMappingURL=AlphaSlider.cjs.map
