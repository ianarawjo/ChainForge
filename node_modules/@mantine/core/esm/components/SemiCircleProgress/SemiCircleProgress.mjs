'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { clamp } from '@mantine/hooks';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './SemiCircleProgress.module.css.mjs';

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
const varsResolver = createVarsResolver(
  (theme, {
    filledSegmentColor,
    emptySegmentColor,
    orientation,
    fillDirection,
    transitionDuration,
    thickness
  }) => ({
    root: {
      "--scp-filled-segment-color": filledSegmentColor ? getThemeColor(filledSegmentColor, theme) : void 0,
      "--scp-empty-segment-color": emptySegmentColor ? getThemeColor(emptySegmentColor, theme) : void 0,
      "--scp-rotation": getRotation({ orientation, fillDirection }),
      "--scp-transition-duration": transitionDuration ? `${transitionDuration}ms` : void 0,
      "--scp-thickness": rem(thickness)
    }
  })
);
const SemiCircleProgress = factory((_props, ref) => {
  const props = useProps("SemiCircleProgress", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "SemiCircleProgress",
    classes,
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
  const semiCirclePercentage = clamp(value, 0, 100) * (circumference / 100);
  return /* @__PURE__ */ jsxs(Box, { ref, size, ...getStyles("root"), ...others, children: [
    label && /* @__PURE__ */ jsx("p", { ...getStyles("label"), "data-position": labelPosition, "data-orientation": orientation, children: label }),
    /* @__PURE__ */ jsxs("svg", { width: size, height: size / 2, ...getStyles("svg"), children: [
      /* @__PURE__ */ jsx(
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
      /* @__PURE__ */ jsx(
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
SemiCircleProgress.classes = classes;

export { SemiCircleProgress };
//# sourceMappingURL=SemiCircleProgress.mjs.map
