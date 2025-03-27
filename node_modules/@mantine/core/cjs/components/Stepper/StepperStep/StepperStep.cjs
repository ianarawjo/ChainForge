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
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
require('../../Checkbox/Checkbox.cjs');
require('../../Checkbox/CheckboxGroup/CheckboxGroup.cjs');
var CheckIcon = require('../../Checkbox/CheckIcon.cjs');
require('../../Checkbox/CheckboxIndicator/CheckboxIndicator.cjs');
require('../../Checkbox/CheckboxCard/CheckboxCard.cjs');
require('../../Checkbox/CheckboxCard/CheckboxCard.context.cjs');
require('../../Checkbox/CheckboxGroup.context.cjs');
var Loader = require('../../Loader/Loader.cjs');
var Transition = require('../../Transition/Transition.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var Stepper_context = require('../Stepper.context.cjs');
var Stepper_module = require('../Stepper.module.css.cjs');

const getStepFragment = (Fragment, step) => {
  if (typeof Fragment === "function") {
    return /* @__PURE__ */ jsxRuntime.jsx(Fragment, { step: step || 0 });
  }
  return Fragment;
};
const defaultProps = {
  withIcon: true,
  allowStepClick: true,
  iconPosition: "left"
};
const StepperStep = factory.factory((props, ref) => {
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    step,
    state,
    color,
    icon,
    completedIcon,
    progressIcon,
    label,
    description,
    withIcon,
    iconSize,
    loading,
    allowStepClick,
    allowStepSelect,
    iconPosition,
    orientation,
    mod,
    ...others
  } = useProps.useProps("StepperStep", defaultProps, props);
  const ctx = Stepper_context.useStepperContext();
  const theme = MantineThemeProvider.useMantineTheme();
  const stylesApi = { classNames, styles };
  const _icon = state === "stepCompleted" ? null : state === "stepProgress" ? progressIcon : icon;
  const dataAttributes = {
    "data-progress": state === "stepProgress" || void 0,
    "data-completed": state === "stepCompleted" || void 0
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ...ctx.getStyles("step", { className, style, variant: ctx.orientation, ...stylesApi }),
      mod: [
        { "icon-position": iconPosition || ctx.iconPosition, "allow-click": allowStepClick },
        mod
      ],
      ref,
      ...dataAttributes,
      ...others,
      __vars: { "--step-color": color ? getThemeColor.getThemeColor(color, theme) : void 0 },
      tabIndex: allowStepClick ? 0 : -1,
      children: [
        withIcon && /* @__PURE__ */ jsxRuntime.jsxs("span", { ...ctx.getStyles("stepWrapper", stylesApi), children: [
          /* @__PURE__ */ jsxRuntime.jsxs("span", { ...ctx.getStyles("stepIcon", stylesApi), ...dataAttributes, children: [
            /* @__PURE__ */ jsxRuntime.jsx(Transition.Transition, { mounted: state === "stepCompleted", transition: "pop", duration: 200, children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx(
              "span",
              {
                ...ctx.getStyles("stepCompletedIcon", { style: transitionStyles, ...stylesApi }),
                children: loading ? /* @__PURE__ */ jsxRuntime.jsx(
                  Loader.Loader,
                  {
                    color: "var(--mantine-color-white)",
                    size: "calc(var(--stepper-icon-size) / 2)",
                    ...ctx.getStyles("stepLoader", stylesApi)
                  }
                ) : getStepFragment(completedIcon, step) || /* @__PURE__ */ jsxRuntime.jsx(CheckIcon.CheckIcon, { size: "60%" })
              }
            ) }),
            state !== "stepCompleted" ? loading ? /* @__PURE__ */ jsxRuntime.jsx(
              Loader.Loader,
              {
                ...ctx.getStyles("stepLoader", stylesApi),
                size: "calc(var(--stepper-icon-size) / 2)",
                color
              }
            ) : getStepFragment(_icon || icon, step) : null
          ] }),
          orientation === "vertical" && /* @__PURE__ */ jsxRuntime.jsx(
            "span",
            {
              ...ctx.getStyles("verticalSeparator", stylesApi),
              "data-active": state === "stepCompleted" || void 0
            }
          )
        ] }),
        (label || description) && /* @__PURE__ */ jsxRuntime.jsxs(
          "span",
          {
            ...ctx.getStyles("stepBody", stylesApi),
            "data-orientation": ctx.orientation,
            "data-icon-position": iconPosition || ctx.iconPosition,
            children: [
              label && /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("stepLabel", stylesApi), children: getStepFragment(label, step) }),
              description && /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("stepDescription", stylesApi), children: getStepFragment(description, step) })
            ]
          }
        )
      ]
    }
  );
});
StepperStep.classes = Stepper_module;
StepperStep.displayName = "@mantine/core/StepperStep";

exports.StepperStep = StepperStep;
//# sourceMappingURL=StepperStep.cjs.map
