'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var useResolvedStylesApi = require('../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var ActionIcon = require('../ActionIcon/ActionIcon.cjs');
require('../ActionIcon/ActionIconGroup/ActionIconGroup.cjs');
require('../ActionIcon/ActionIconGroupSection/ActionIconGroupSection.cjs');
var ColorPicker = require('../ColorPicker/ColorPicker.cjs');
require('../ColorPicker/AlphaSlider/AlphaSlider.cjs');
require('../ColorPicker/HueSlider/HueSlider.cjs');
var converters = require('../ColorPicker/converters/converters.cjs');
var parsers = require('../ColorPicker/converters/parsers.cjs');
var ColorSwatch = require('../ColorSwatch/ColorSwatch.cjs');
var Input = require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
var useInputProps = require('../Input/use-input-props.cjs');
require('../Input/InputWrapper.context.cjs');
var InputBase = require('../InputBase/InputBase.cjs');
var Popover = require('../Popover/Popover.cjs');
require('../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../Popover/PopoverTarget/PopoverTarget.cjs');
var EyeDropperIcon = require('./EyeDropperIcon.cjs');
var ColorInput_module = require('./ColorInput.module.css.cjs');

const defaultProps = {
  format: "hex",
  fixOnBlur: true,
  withPreview: true,
  swatchesPerRow: 7,
  withPicker: true,
  popoverProps: { transitionProps: { transition: "fade", duration: 0 } },
  withEyeDropper: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  eyeDropperIcon: {
    "--ci-eye-dropper-icon-size": getSize.getSize(size, "ci-eye-dropper-icon-size")
  },
  colorPreview: {
    "--ci-preview-size": getSize.getSize(size, "ci-preview-size")
  }
}));
const ColorInput = factory.factory((_props, ref) => {
  const props = useProps.useProps("ColorInput", defaultProps, _props);
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
  } = useInputProps.useInputProps("ColorInput", defaultProps, _props);
  const getStyles = useStyles.useStyles({
    name: "ColorInput",
    props,
    classes: ColorInput_module,
    classNames,
    styles,
    unstyled,
    rootSelector: "wrapper",
    vars: props.vars,
    varsResolver
  });
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const [dropdownOpened, setDropdownOpened] = React.useState(false);
  const [lastValidValue, setLastValidValue] = React.useState("");
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const { supported: eyeDropperSupported, open: openEyeDropper } = hooks.useEyeDropper();
  const eyeDropper = /* @__PURE__ */ jsxRuntime.jsx(
    ActionIcon.ActionIcon,
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
          const color = converters.convertHsvaTo(format, parsers.parseColor(payload.sRGBHex));
          setValue(color);
          onChangeEnd?.(color);
        }
      }).catch(() => {
      }),
      children: eyeDropperIcon || /* @__PURE__ */ jsxRuntime.jsx(EyeDropperIcon.EyeDropperIcon, { ...getStyles("eyeDropperIcon") })
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
  React.useEffect(() => {
    if (parsers.isColorValid(_value) || _value.trim() === "") {
      setLastValidValue(_value);
    }
  }, [_value]);
  hooks.useDidUpdate(() => {
    if (parsers.isColorValid(_value)) {
      setValue(converters.convertHsvaTo(format, parsers.parseColor(_value)));
    }
  }, [format]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Input.Input.Wrapper,
    {
      ...wrapperProps,
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      __staticSelector: "ColorInput",
      children: /* @__PURE__ */ jsxRuntime.jsxs(
        Popover.Popover,
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
            /* @__PURE__ */ jsxRuntime.jsx(Popover.Popover.Target, { children: /* @__PURE__ */ jsxRuntime.jsx(
              Input.Input,
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
                  if (parsers.isColorValid(inputValue)) {
                    onChangeEnd?.(converters.convertHsvaTo(format, parsers.parseColor(inputValue)));
                  }
                },
                leftSection: leftSection || (withPreview ? /* @__PURE__ */ jsxRuntime.jsx(
                  ColorSwatch.ColorSwatch,
                  {
                    color: parsers.isColorValid(_value) ? _value : "#fff",
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
            /* @__PURE__ */ jsxRuntime.jsx(
              Popover.Popover.Dropdown,
              {
                onMouseDown: (event) => event.preventDefault(),
                className: ColorInput_module.dropdown,
                children: /* @__PURE__ */ jsxRuntime.jsx(
                  ColorPicker.ColorPicker,
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
ColorInput.classes = InputBase.InputBase.classes;
ColorInput.displayName = "@mantine/core/ColorInput";

exports.ColorInput = ColorInput;
//# sourceMappingURL=ColorInput.cjs.map
