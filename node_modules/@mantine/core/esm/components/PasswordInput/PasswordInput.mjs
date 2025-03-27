'use client';
import { jsx } from 'react/jsx-runtime';
import cx from 'clsx';
import { useId, useUncontrolled } from '@mantine/hooks';
import 'react';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import { useResolvedStylesApi } from '../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { extractStyleProps } from '../../core/Box/style-props/extract-style-props/extract-style-props.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { ActionIcon } from '../ActionIcon/ActionIcon.mjs';
import '../ActionIcon/ActionIconGroup/ActionIconGroup.mjs';
import '../ActionIcon/ActionIconGroupSection/ActionIconGroupSection.mjs';
import { Input } from '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import '../Input/InputWrapper.context.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';
import { PasswordToggleIcon } from './PasswordToggleIcon.mjs';
import classes from './PasswordInput.module.css.mjs';

const defaultProps = {
  visibilityToggleIcon: PasswordToggleIcon
};
const varsResolver = createVarsResolver((_, { size }) => ({
  root: {
    "--psi-icon-size": getSize(size, "psi-icon-size"),
    "--psi-button-size": getSize(size, "psi-button-size")
  }
}));
const PasswordInput = factory((_props, ref) => {
  const props = useProps("PasswordInput", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    required,
    error,
    leftSection,
    disabled,
    id,
    variant,
    inputContainer,
    description,
    label,
    size,
    errorProps,
    descriptionProps,
    labelProps,
    withAsterisk,
    inputWrapperOrder,
    wrapperProps,
    radius,
    rightSection,
    rightSectionWidth,
    rightSectionPointerEvents,
    leftSectionWidth,
    visible,
    defaultVisible,
    onVisibilityChange,
    visibilityToggleIcon,
    visibilityToggleButtonProps,
    rightSectionProps,
    leftSectionProps,
    leftSectionPointerEvents,
    withErrorStyles,
    mod,
    ...others
  } = props;
  const uuid = useId(id);
  const [_visible, setVisibility] = useUncontrolled({
    value: visible,
    defaultValue: defaultVisible,
    finalValue: false,
    onChange: onVisibilityChange
  });
  const toggleVisibility = () => setVisibility(!_visible);
  const getStyles = useStyles({
    name: "PasswordInput",
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
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const { styleProps, rest } = extractStyleProps(others);
  const VisibilityToggleIcon = visibilityToggleIcon;
  const visibilityToggleButton = /* @__PURE__ */ jsx(
    ActionIcon,
    {
      ...getStyles("visibilityToggle"),
      disabled,
      radius,
      "aria-hidden": !visibilityToggleButtonProps,
      tabIndex: -1,
      ...visibilityToggleButtonProps,
      variant: visibilityToggleButtonProps?.variant ?? "subtle",
      color: "gray",
      unstyled,
      onTouchEnd: (event) => {
        event.preventDefault();
        visibilityToggleButtonProps?.onTouchEnd?.(event);
        toggleVisibility();
      },
      onMouseDown: (event) => {
        event.preventDefault();
        visibilityToggleButtonProps?.onMouseDown?.(event);
        toggleVisibility();
      },
      onKeyDown: (event) => {
        visibilityToggleButtonProps?.onKeyDown?.(event);
        if (event.key === " ") {
          event.preventDefault();
          toggleVisibility();
        }
      },
      children: /* @__PURE__ */ jsx(VisibilityToggleIcon, { reveal: _visible })
    }
  );
  return /* @__PURE__ */ jsx(
    Input.Wrapper,
    {
      required,
      id: uuid,
      label,
      error,
      description,
      size,
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      __staticSelector: "PasswordInput",
      errorProps,
      descriptionProps,
      unstyled,
      withAsterisk,
      inputWrapperOrder,
      inputContainer,
      variant,
      labelProps: { ...labelProps, htmlFor: uuid },
      mod,
      ...getStyles("root"),
      ...styleProps,
      ...wrapperProps,
      children: /* @__PURE__ */ jsx(
        Input,
        {
          component: "div",
          error,
          leftSection,
          size,
          classNames: { ...resolvedClassNames, input: cx(classes.input, resolvedClassNames.input) },
          styles: resolvedStyles,
          radius,
          disabled,
          __staticSelector: "PasswordInput",
          rightSectionWidth,
          rightSection: rightSection ?? visibilityToggleButton,
          variant,
          unstyled,
          leftSectionWidth,
          rightSectionPointerEvents: rightSectionPointerEvents || "all",
          rightSectionProps,
          leftSectionProps,
          leftSectionPointerEvents,
          withAria: false,
          withErrorStyles,
          children: /* @__PURE__ */ jsx(
            "input",
            {
              required,
              "data-invalid": !!error || void 0,
              "data-with-left-section": !!leftSection || void 0,
              ...getStyles("innerInput"),
              disabled,
              id: uuid,
              ref,
              ...rest,
              autoComplete: rest.autoComplete || "off",
              type: _visible ? "text" : "password"
            }
          )
        }
      )
    }
  );
});
PasswordInput.classes = { ...InputBase.classes, ...classes };
PasswordInput.displayName = "@mantine/core/PasswordInput";

export { PasswordInput };
//# sourceMappingURL=PasswordInput.mjs.map
