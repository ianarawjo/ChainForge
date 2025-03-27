'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Tooltip = require('../../Tooltip/Tooltip.cjs');
require('../../Tooltip/TooltipGroup/TooltipGroup.cjs');
require('../../Tooltip/TooltipFloating/TooltipFloating.cjs');
var getCurveProps = require('./get-curve-props.cjs');

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
  const theme = MantineThemeProvider.useMantineTheme();
  return /* @__PURE__ */ jsxRuntime.jsx(Tooltip.Tooltip.Floating, { disabled: !tooltip, label: tooltip, children: /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "circle",
      ...others,
      ...getStyles("curve"),
      __vars: { "--curve-color": color ? getThemeColor.getThemeColor(color, theme) : void 0 },
      fill: "none",
      strokeLinecap: lineRoundCaps ? "round" : "butt",
      ...getCurveProps.getCurveProps({ sum, size, thickness, value, offset, root })
    }
  ) });
}
Curve.displayName = "@mantine/core/Curve";

exports.Curve = Curve;
//# sourceMappingURL=Curve.cjs.map
