'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Tooltip } from '../../Tooltip/Tooltip.mjs';
import '../../Tooltip/TooltipGroup/TooltipGroup.mjs';
import '../../Tooltip/TooltipFloating/TooltipFloating.mjs';
import { getCurveProps } from './get-curve-props.mjs';

function Curve({
  size,
  value,
  offset,
  sum,
  thickness,
  root,
  color,
  lineRoundCaps,
  tooltip,
  getStyles,
  display,
  ...others
}) {
  const theme = useMantineTheme();
  return /* @__PURE__ */ jsx(Tooltip.Floating, { disabled: !tooltip, label: tooltip, children: /* @__PURE__ */ jsx(
    Box,
    {
      component: "circle",
      ...others,
      ...getStyles("curve"),
      __vars: { "--curve-color": color ? getThemeColor(color, theme) : void 0 },
      fill: "none",
      strokeLinecap: lineRoundCaps ? "round" : "butt",
      ...getCurveProps({ sum, size, thickness, value, offset, root })
    }
  ) });
}
Curve.displayName = "@mantine/core/Curve";

export { Curve };
//# sourceMappingURL=Curve.mjs.map
