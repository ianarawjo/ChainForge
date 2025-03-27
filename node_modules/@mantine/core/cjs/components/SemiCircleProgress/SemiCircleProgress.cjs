'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var SemiCircleProgress_module = require('./SemiCircleProgress.module.css.cjs');

const defaultProps = {
  size: 200,
  thickness: 12,
  orientation: "up",
  fillDirection: "left-to-right",
  labelPosition: "bottom"
};
function getRotation({
  orientation,
  fillDirection
}) {
  if (orientation === "down") {
    if (fillDirection === "right-to-left") {
      return "rotate(180deg) rotateY(180deg)";
    }
    return "rotate(180deg)";
  }
  if (fillDirection === "left-to-right") {
    return "rotateY(180deg)";
  }
  return void 0;
}
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, {
    filledSegmentColor,
    emptySegmentColor,
    orientation,
    fillDirection,
    transitionDuration,
    thickness
  }) => ({
    root: {
      "--scp-filled-segment-color": filledSegmentColor ? getThemeColor.getThemeColor(filledSegmentColor, theme) : void 0,
      "--scp-empty-segment-color": emptySegmentColor ? getThemeColor.getThemeColor(emptySegmentColor, theme) : void 0,
      "--scp-rotation": getRotation({ orientation, fillDirection }),
      "--scp-transition-duration": transitionDuration ? `${transitionDuration}ms` : void 0,
      "--scp-thickness": rem.rem(thickness)
    }
  })
);
const SemiCircleProgress = factory.factory((_props, ref) => {
  const props = useProps.useProps("SemiCircleProgress", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    size,
    thickness,
    value,
    orientation,
    fillDirection,
    filledSegmentColor,
    emptySegmentColor,
    transitionDuration,
    label,
    labelPosition,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "SemiCircleProgress",
    classes: SemiCircleProgress_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const coordinateForCircle = size / 2;
  const radius = (size - 2 * thickness) / 2;
  const circumference = Math.PI * radius;
  const semiCirclePercentage = hooks.clamp(value, 0, 100) * (circumference / 100);
  return /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ref, size, ...getStyles("root"), ...others, children: [
    label && /* @__PURE__ */ jsxRuntime.jsx("p", { ...getStyles("label"), "data-position": labelPosition, "data-orientation": orientation, children: label }),
    /* @__PURE__ */ jsxRuntime.jsxs("svg", { width: size, height: size / 2, ...getStyles("svg"), children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "circle",
        {
          cx: coordinateForCircle,
          cy: coordinateForCircle,
          r: radius,
          fill: "none",
          stroke: "var(--scp-empty-segment-color)",
          strokeWidth: thickness,
          strokeDasharray: circumference,
          ...getStyles("emptySegment", { style: { strokeDashoffset: circumference } })
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        "circle",
        {
          cx: coordinateForCircle,
          cy: coordinateForCircle,
          r: radius,
          fill: "none",
          stroke: "var(--scp-filled-segment-color)",
          strokeWidth: thickness,
          strokeDasharray: circumference,
          ...getStyles("filledSegment", { style: { strokeDashoffset: semiCirclePercentage } })
        }
      )
    ] })
  ] });
});
SemiCircleProgress.displayName = "@mantine/core/SemiCircleProgress";
SemiCircleProgress.classes = SemiCircleProgress_module;

exports.SemiCircleProgress = SemiCircleProgress;
//# sourceMappingURL=SemiCircleProgress.cjs.map
