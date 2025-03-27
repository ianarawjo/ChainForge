'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { useUncontrolled, useEyeDropper, useDidUpdate } from '@mantine/hooks';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { useResolvedStylesApi } from '../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { ActionIcon } from '../ActionIcon/ActionIcon.mjs';
import '../ActionIcon/ActionIconGroup/ActionIconGroup.mjs';
import '../ActionIcon/ActionIconGroupSection/ActionIconGroupSection.mjs';
import { ColorPicker } from '../ColorPicker/ColorPicker.mjs';
import '../ColorPicker/AlphaSlider/AlphaSlider.mjs';
import '../ColorPicker/HueSlider/HueSlider.mjs';
import { convertHsvaTo } from '../ColorPicker/converters/converters.mjs';
import { parseColor, isColorValid } from '../ColorPicker/converters/parsers.mjs';
import { ColorSwatch } from '../ColorSwatch/ColorSwatch.mjs';
import { Input } from '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import { useInputProps } from '../Input/use-input-props.mjs';
import '../Input/InputWrapper.context.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';
import { Popover } from '../Popover/Popover.mjs';
import '../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../Popover/PopoverTarget/PopoverTarget.mjs';
import { EyeDropperIcon } from './EyeDropperIcon.mjs';
import classes from './ColorInput.module.css.mjs';

const defaultProps = {
  format: "hex",
  fixOnBlur: true,
  withPreview: true,
  swatchesPerRow: 7,
  withPicker: true,
  popoverProps: { transitionProps: { transition: "fade", duration: 0 } },
  withEyeDropper: true
};
const varsResolver = createVarsResolver((_, { size }) => ({
  eyeDropperIcon: {
    "--ci-eye-dropper-icon-size": getSize(size, "ci-eye-dropper-icon-size")
  },
  colorPreview: {
    "--ci-preview-size": getSize(size, "ci-preview-size")
  }
}));
const ColorInput = factory((_props, ref) => {
  const props = useProps("ColorInput", defaultProps, _props);
  const {
    classNames,
    styles,
    unstyled,
    disallowInput,
    fixOnBlur,
    popoverProps,
    withPreview,
    withEyeDropper,
    eyeDropperIcon,
    closeOnColorSwatchClick,
    eyeDropperButtonProps,
    value,
    defaultValue,
    onChange,
    onChangeEnd,
    onClick,
    onFocus,
    onBlur,
    inputProps,
    format,
    wrapperProps,
    readOnly,
    withPicker,
    swatches,
    disabled,
    leftSection,
    rightSection,
    swatchesPerRow,
    ...others
  } = useInputProps("ColorInput", defaultProps, _props);
  const getStyles = useStyles({
    name: "ColorInput",
    props,
    classes,
    classNames,
    styles,
    unstyled,
    rootSelector: "wrapper",
    vars: props.vars,
    varsResolver
  });
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const [dropdownOpened, setDropdownOpened] = useState(false);
  const [lastValidValue, setLastValidValue] = useState("");
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const { supported: eyeDropperSupported, open: openEyeDropper } = useEyeDropper();
  const eyeDropper = /* @__PURE__ */ jsx(
    ActionIcon,
    {
      ...eyeDropperButtonProps,
      ...getStyles("eyeDropperButton", {
        className: eyeDropperButtonProps?.className,
        style: eyeDropperButtonProps?.style
      }),
      variant: "subtle",
      color: "gray",
      size: inputProps.size,
      unstyled,
      onClick: () => openEyeDropper().then((payload) => {
        if (payload?.sRGBHex) {
          const color = convertHsvaTo(format, parseColor(payload.sRGBHex));
          setValue(color);
          onChangeEnd?.(color);
        }
      }).catch(() => {
      }),
      children: eyeDropperIcon || /* @__PURE__ */ jsx(EyeDropperIcon, { ...getStyles("eyeDropperIcon") })
    }
  );
  const handleInputFocus = (event) => {
    onFocus?.(event);
    setDropdownOpened(true);
  };
  const handleInputBlur = (event) => {
    fixOnBlur && setValue(lastValidValue);
    onBlur?.(event);
    setDropdownOpened(false);
  };
  const handleInputClick = (event) => {
    onClick?.(event);
    setDropdownOpened(true);
  };
  useEffect(() => {
    if (isColorValid(_value) || _value.trim() === "") {
      setLastValidValue(_value);
    }
  }, [_value]);
  useDidUpdate(() => {
    if (isColorValid(_value)) {
      setValue(convertHsvaTo(format, parseColor(_value)));
    }
  }, [format]);
  return /* @__PURE__ */ jsx(
    Input.Wrapper,
    {
      ...wrapperProps,
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      __staticSelector: "ColorInput",
      children: /* @__PURE__ */ jsxs(
        Popover,
        {
          __staticSelector: "ColorInput",
          position: "bottom-start",
          offset: 5,
          opened: dropdownOpened,
          ...popoverProps,
          classNames: resolvedClassNames,
          styles: resolvedStyles,
          unstyled,
          withRoles: false,
          disabled: readOnly || withPicker === false && (!Array.isArray(swatches) || swatches.length === 0),
          children: [
            /* @__PURE__ */ jsx(Popover.Target, { children: /* @__PURE__ */ jsx(
              Input,
              {
                autoComplete: "off",
                ...others,
                ...inputProps,
                classNames: resolvedClassNames,
                styles: resolvedStyles,
                disabled,
                ref,
                __staticSelector: "ColorInput",
                onFocus: handleInputFocus,
                onBlur: handleInputBlur,
                onClick: handleInputClick,
                spellCheck: false,
                value: _value,
                onChange: (event) => {
                  const inputValue = event.currentTarget.value;
                  setValue(inputValue);
                  if (isColorValid(inputValue)) {
                    onChangeEnd?.(convertHsvaTo(format, parseColor(inputValue)));
                  }
                },
                leftSection: leftSection || (withPreview ? /* @__PURE__ */ jsx(
                  ColorSwatch,
                  {
                    color: isColorValid(_value) ? _value : "#fff",
                    size: "var(--ci-preview-size)",
                    ...getStyles("colorPreview")
                  }
                ) : null),
                readOnly: disallowInput || readOnly,
                pointer: disallowInput,
                unstyled,
                rightSection: rightSection || (withEyeDropper && !disabled && !readOnly && eyeDropperSupported ? eyeDropper : null)
              }
            ) }),
            /* @__PURE__ */ jsx(
              Popover.Dropdown,
              {
                onMouseDown: (event) => event.preventDefault(),
                className: classes.dropdown,
                children: /* @__PURE__ */ jsx(
                  ColorPicker,
                  {
                    __staticSelector: "ColorInput",
                    value: _value,
                    onChange: setValue,
                    onChangeEnd,
                    format,
                    swatches,
                    swatchesPerRow,
                    withPicker,
                    size: inputProps.size,
                    focusable: false,
                    unstyled,
                    styles: resolvedStyles,
                    classNames: resolvedClassNames,
                    onColorSwatchClick: () => closeOnColorSwatchClick && setDropdownOpened(false)
                  }
                )
              }
            )
          ]
        }
      )
    }
  );
});
ColorInput.classes = InputBase.classes;
ColorInput.displayName = "@mantine/core/ColorInput";

export { ColorInput };
//# sourceMappingURL=ColorInput.mjs.map
