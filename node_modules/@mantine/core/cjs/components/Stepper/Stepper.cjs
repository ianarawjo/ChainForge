'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var rem = require('../../core/utils/units-converters/rem.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var getContrastColor = require('../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
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
var Stepper_context = require('./Stepper.context.cjs');
var StepperCompleted = require('./StepperCompleted/StepperCompleted.cjs');
var StepperStep = require('./StepperStep/StepperStep.cjs');
var Stepper_module = require('./Stepper.module.css.cjs');

const defaultProps = {
  orientation: "horizontal",
  iconPosition: "left",
  allowNextStepsSelect: true,
  wrap: true
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { color, iconSize, size, contentPadding, radius, autoContrast }) => ({
    root: {
      "--stepper-color": color ? getThemeColor.getThemeColor(color, theme) : void 0,
      "--stepper-icon-color": getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0,
      "--stepper-icon-size": iconSize === void 0 ? getSize.getSize(size, "stepper-icon-size") : rem.rem(iconSize),
      "--stepper-content-padding": getSize.getSpacing(contentPadding),
      "--stepper-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
      "--stepper-fz": getSize.getFontSize(size),
      "--stepper-spacing": getSize.getSpacing(size)
    }
  })
);
const Stepper = factory.factory((_props, ref) => {
  const props = useProps.useProps("Stepper", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "Stepper",
    classes: Stepper_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const convertedChildren = React.Children.toArray(children);
  const _children = convertedChildren.filter(
    (child) => child.type !== StepperCompleted.StepperCompleted
  );
  const completedStep = convertedChildren.find(
    (item) => item.type === StepperCompleted.StepperCompleted
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
        React.cloneElement(item, {
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
          /* @__PURE__ */ React.createElement(
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
  return /* @__PURE__ */ jsxRuntime.jsx(Stepper_context.StepperProvider, { value: { getStyles, orientation, iconPosition }, children: /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ...getStyles("root"), ref, size, ...others, children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
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
    content && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("content"), children: content })
  ] }) });
});
Stepper.classes = Stepper_module;
Stepper.displayName = "@mantine/core/Stepper";
Stepper.Completed = StepperCompleted.StepperCompleted;
Stepper.Step = StepperStep.StepperStep;

exports.Stepper = Stepper;
//# sourceMappingURL=Stepper.cjs.map
