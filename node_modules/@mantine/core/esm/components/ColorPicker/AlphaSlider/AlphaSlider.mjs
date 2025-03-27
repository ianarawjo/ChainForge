'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { rem } from '../../../core/utils/units-converters/rem.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { ColorSlider } from '../ColorSlider/ColorSlider.mjs';
import { round } from '../converters/parsers.mjs';

const defaultProps = {};
const AlphaSlider = forwardRef((props, ref) => {
  const { value, onChange, onChangeEnd, color, ...others } = useProps(
    "AlphaSlider",
    defaultProps,
    props
  );
  return /* @__PURE__ */ jsx(
    ColorSlider,
    {
      ...others,
      ref,
      value,
      onChange: (val) => onChange?.(round(val, 2)),
      onChangeEnd: (val) => onChangeEnd?.(round(val, 2)),
      maxValue: 1,
      round: false,
      "data-alpha": true,
      overlays: [
        {
          backgroundImage: "linear-gradient(45deg, var(--slider-checkers) 25%, transparent 25%), linear-gradient(-45deg, var(--slider-checkers) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--slider-checkers) 75%), linear-gradient(-45deg, var(--mantine-color-body) 75%, var(--slider-checkers) 75%)",
          backgroundSize: `${rem(8)} ${rem(8)}`,
          backgroundPosition: `0 0, 0 ${rem(4)}, ${rem(4)} ${rem(-4)}, ${rem(-4)} 0`
        },
        {
          backgroundImage: `linear-gradient(90deg, transparent, ${color})`
        },
        {
          boxShadow: `rgba(0, 0, 0, .1) 0 0 0 ${rem(1)} inset, rgb(0, 0, 0, .15) 0 0 ${rem(
            4
          )} inset`
        }
      ]
    }
  );
});
AlphaSlider.displayName = "@mantine/core/AlphaSlider";

export { AlphaSlider };
//# sourceMappingURL=AlphaSlider.mjs.map
