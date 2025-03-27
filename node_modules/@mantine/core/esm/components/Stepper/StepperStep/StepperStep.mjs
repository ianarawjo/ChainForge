'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import '../../Checkbox/Checkbox.mjs';
import '../../Checkbox/CheckboxGroup/CheckboxGroup.mjs';
import { CheckIcon } from '../../Checkbox/CheckIcon.mjs';
import '../../Checkbox/CheckboxIndicator/CheckboxIndicator.mjs';
import '../../Checkbox/CheckboxCard/CheckboxCard.mjs';
import '../../Checkbox/CheckboxCard/CheckboxCard.context.mjs';
import '../../Checkbox/CheckboxGroup.context.mjs';
import { Loader } from '../../Loader/Loader.mjs';
import { Transition } from '../../Transition/Transition.mjs';
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { useStepperContext } from '../Stepper.context.mjs';
import classes from '../Stepper.module.css.mjs';

const getStepFragment = (Fragment, step) => {
  if (typeof Fragment === "function") {
    return /* @__PURE__ */ jsx(Fragment, { step: step || 0 });
  }
  return Fragment;
};
const defaultProps = {
  withIcon: true,
  allowStepClick: true,
  iconPosition: "left"
};
const StepperStep = factory((props, ref) => {
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
  } = useProps("StepperStep", defaultProps, props);
  const ctx = useStepperContext();
  const theme = useMantineTheme();
  const stylesApi = { classNames, styles };
  const _icon = state === "stepCompleted" ? null : state === "stepProgress" ? progressIcon : icon;
  const dataAttributes = {
    "data-progress": state === "stepProgress" || void 0,
    "data-completed": state === "stepCompleted" || void 0
  };
  return /* @__PURE__ */ jsxs(
    UnstyledButton,
    {
      ...ctx.getStyles("step", { className, style, variant: ctx.orientation, ...stylesApi }),
      mod: [
        { "icon-position": iconPosition || ctx.iconPosition, "allow-click": allowStepClick },
        mod
      ],
      ref,
      ...dataAttributes,
      ...others,
      __vars: { "--step-color": color ? getThemeColor(color, theme) : void 0 },
      tabIndex: allowStepClick ? 0 : -1,
      children: [
        withIcon && /* @__PURE__ */ jsxs("span", { ...ctx.getStyles("stepWrapper", stylesApi), children: [
          /* @__PURE__ */ jsxs("span", { ...ctx.getStyles("stepIcon", stylesApi), ...dataAttributes, children: [
            /* @__PURE__ */ jsx(Transition, { mounted: state === "stepCompleted", transition: "pop", duration: 200, children: (transitionStyles) => /* @__PURE__ */ jsx(
              "span",
              {
                ...ctx.getStyles("stepCompletedIcon", { style: transitionStyles, ...stylesApi }),
                children: loading ? /* @__PURE__ */ jsx(
                  Loader,
                  {
                    color: "var(--mantine-color-white)",
                    size: "calc(var(--stepper-icon-size) / 2)",
                    ...ctx.getStyles("stepLoader", stylesApi)
                  }
                ) : getStepFragment(completedIcon, step) || /* @__PURE__ */ jsx(CheckIcon, { size: "60%" })
              }
            ) }),
            state !== "stepCompleted" ? loading ? /* @__PURE__ */ jsx(
              Loader,
              {
                ...ctx.getStyles("stepLoader", stylesApi),
                size: "calc(var(--stepper-icon-size) / 2)",
                color
              }
            ) : getStepFragment(_icon || icon, step) : null
          ] }),
          orientation === "vertical" && /* @__PURE__ */ jsx(
            "span",
            {
              ...ctx.getStyles("verticalSeparator", stylesApi),
              "data-active": state === "stepCompleted" || void 0
            }
          )
        ] }),
        (label || description) && /* @__PURE__ */ jsxs(
          "span",
          {
            ...ctx.getStyles("stepBody", stylesApi),
            "data-orientation": ctx.orientation,
            "data-icon-position": iconPosition || ctx.iconPosition,
            children: [
              label && /* @__PURE__ */ jsx("span", { ...ctx.getStyles("stepLabel", stylesApi), children: getStepFragment(label, step) }),
              description && /* @__PURE__ */ jsx("span", { ...ctx.getStyles("stepDescription", stylesApi), children: getStepFragment(description, step) })
            ]
          }
        )
      ]
    }
  );
});
StepperStep.classes = classes;
StepperStep.displayName = "@mantine/core/StepperStep";

export { StepperStep };
//# sourceMappingURL=StepperStep.mjs.map
