'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Children, cloneElement, createElement } from 'react';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import { getSize, getSpacing, getRadius, getFontSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { getContrastColor } from '../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.mjs';
import { getAutoContrastValue } from '../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.mjs';
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
import { StepperProvider } from './Stepper.context.mjs';
import { StepperCompleted } from './StepperCompleted/StepperCompleted.mjs';
import { StepperStep } from './StepperStep/StepperStep.mjs';
import classes from './Stepper.module.css.mjs';

const defaultProps = {
  orientation: "horizontal",
  iconPosition: "left",
  allowNextStepsSelect: true,
  wrap: true
};
const varsResolver = createVarsResolver(
  (theme, { color, iconSize, size, contentPadding, radius, autoContrast }) => ({
    root: {
      "--stepper-color": color ? getThemeColor(color, theme) : void 0,
      "--stepper-icon-color": getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0,
      "--stepper-icon-size": iconSize === void 0 ? getSize(size, "stepper-icon-size") : rem(iconSize),
      "--stepper-content-padding": getSpacing(contentPadding),
      "--stepper-radius": radius === void 0 ? void 0 : getRadius(radius),
      "--stepper-fz": getFontSize(size),
      "--stepper-spacing": getSpacing(size)
    }
  })
);
const Stepper = factory((_props, ref) => {
  const props = useProps("Stepper", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    onStepClick,
    active,
    icon,
    completedIcon,
    progressIcon,
    color,
    iconSize,
    contentPadding,
    orientation,
    iconPosition,
    size,
    radius,
    allowNextStepsSelect,
    wrap,
    autoContrast,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Stepper",
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
  const convertedChildren = Children.toArray(children);
  const _children = convertedChildren.filter(
    (child) => child.type !== StepperCompleted
  );
  const completedStep = convertedChildren.find(
    (item) => item.type === StepperCompleted
  );
  const items = _children.reduce(
    (acc, item, index) => {
      const state = active === index ? "stepProgress" : active > index ? "stepCompleted" : "stepInactive";
      const shouldAllowSelect = () => {
        if (typeof onStepClick !== "function") {
          return false;
        }
        if (typeof item.props.allowStepSelect === "boolean") {
          return item.props.allowStepSelect;
        }
        return state === "stepCompleted" || allowNextStepsSelect;
      };
      const isStepSelectionEnabled = shouldAllowSelect();
      acc.push(
        cloneElement(item, {
          icon: item.props.icon || icon || index + 1,
          key: index,
          step: index,
          state,
          onClick: () => isStepSelectionEnabled && onStepClick?.(index),
          allowStepClick: isStepSelectionEnabled,
          completedIcon: item.props.completedIcon || completedIcon,
          progressIcon: item.props.progressIcon || progressIcon,
          color: item.props.color || color,
          iconSize,
          iconPosition: item.props.iconPosition || iconPosition,
          orientation
        })
      );
      if (orientation === "horizontal" && index !== _children.length - 1) {
        acc.push(
          /* @__PURE__ */ createElement(
            "div",
            {
              ...getStyles("separator"),
              "data-active": index < active || void 0,
              "data-orientation": orientation,
              key: `separator-${index}`
            }
          )
        );
      }
      return acc;
    },
    []
  );
  const stepContent = _children[active]?.props?.children;
  const completedContent = completedStep?.props?.children;
  const content = active > _children.length - 1 ? completedContent : stepContent;
  return /* @__PURE__ */ jsx(StepperProvider, { value: { getStyles, orientation, iconPosition }, children: /* @__PURE__ */ jsxs(Box, { ...getStyles("root"), ref, size, ...others, children: [
    /* @__PURE__ */ jsx(
      Box,
      {
        ...getStyles("steps"),
        mod: {
          orientation,
          "icon-position": iconPosition,
          wrap: wrap && orientation !== "vertical"
        },
        children: items
      }
    ),
    content && /* @__PURE__ */ jsx("div", { ...getStyles("content"), children: content })
  ] }) });
});
Stepper.classes = classes;
Stepper.displayName = "@mantine/core/Stepper";
Stepper.Completed = StepperCompleted;
Stepper.Step = StepperStep;

export { Stepper };
//# sourceMappingURL=Stepper.mjs.map
