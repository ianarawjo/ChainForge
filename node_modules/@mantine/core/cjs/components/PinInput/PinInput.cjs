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
var Group = require('../Group/Group.cjs');
var Input = require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
require('../Input/InputWrapper.context.cjs');
var InputBase = require('../InputBase/InputBase.cjs');
var createPinArray = require('./create-pin-array/create-pin-array.cjs');
var PinInput_module = require('./PinInput.module.css.cjs');

const regex = {
  number: /^[0-9]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/i
};
const defaultProps = {
  gap: "sm",
  length: 4,
  manageFocus: true,
  oneTimeCode: true,
  placeholder: "\u25CB",
  type: "alphanumeric",
  ariaLabel: "PinInput"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  root: {
    "--pin-input-size": getSize.getSize(size ?? defaultProps.size, "pin-input-size")
  }
}));
const PinInput = factory.factory((props, ref) => {
  const {
    name,
    form,
    className,
    value,
    defaultValue,
    variant,
    gap,
    style,
    size,
    classNames,
    styles,
    unstyled,
    length,
    onChange,
    onComplete,
    manageFocus,
    autoFocus,
    error,
    radius,
    disabled,
    oneTimeCode,
    placeholder,
    type,
    mask,
    readOnly,
    inputType,
    inputMode,
    ariaLabel,
    vars,
    id,
    hiddenInputProps,
    rootRef,
    getInputProps,
    ...others
  } = useProps.useProps("PinInput", defaultProps, props);
  const uuid = hooks.useId(id);
  const getStyles = useStyles.useStyles({
    name: "PinInput",
    classes: PinInput_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const [_value, setValues] = hooks.useUncontrolled({
    value: value ? createPinArray.createPinArray(length ?? 0, value) : void 0,
    defaultValue: defaultValue?.split("").slice(0, length ?? 0),
    finalValue: createPinArray.createPinArray(length ?? 0, ""),
    onChange: typeof onChange === "function" ? (val) => {
      onChange(val.join("").trim());
    } : void 0
  });
  const _valueToString = _value.join("").trim();
  const inputsRef = React.useRef([]);
  const validate = (code) => {
    const re = type instanceof RegExp ? type : type && type in regex ? regex[type] : null;
    return re?.test(code);
  };
  const focusInputField = (dir, index, event) => {
    if (!manageFocus) {
      event?.preventDefault();
      return;
    }
    if (dir === "next") {
      const nextIndex = index + 1;
      const canFocusNext = nextIndex < (length ?? 0);
      if (canFocusNext) {
        event?.preventDefault();
        inputsRef.current[nextIndex].focus();
      }
    }
    if (dir === "prev") {
      const nextIndex = index - 1;
      const canFocusNext = nextIndex > -1;
      if (canFocusNext) {
        event?.preventDefault();
        inputsRef.current[nextIndex].focus();
      }
    }
  };
  const setFieldValue = (val, index) => {
    const values = [..._value];
    values[index] = val;
    setValues(values);
  };
  const handleChange = (event, index) => {
    const inputValue = event.target.value;
    const nextCharOrValue = inputValue.length === 2 ? inputValue.split("")[inputValue.length - 1] : inputValue;
    const isValid = validate(nextCharOrValue);
    if (nextCharOrValue.length < 2) {
      if (isValid) {
        setFieldValue(nextCharOrValue, index);
        focusInputField("next", index);
      } else {
        setFieldValue("", index);
      }
    } else if (isValid) {
      setValues(createPinArray.createPinArray(length ?? 0, inputValue));
    }
  };
  const handleKeyDown = (event, index) => {
    const { ctrlKey, metaKey, key, shiftKey, target } = event;
    const inputValue = target.value;
    if (inputMode === "numeric") {
      const canTypeSign = key === "Backspace" || key === "Tab" || key === "Control" || key === "Delete" || ctrlKey && key === "v" || metaKey && key === "v" ? true : !Number.isNaN(Number(key));
      if (!canTypeSign) {
        event.preventDefault();
      }
    }
    if (key === "ArrowLeft" || shiftKey && key === "Tab") {
      focusInputField("prev", index, event);
    } else if (key === "ArrowRight" || key === "Tab" || key === " ") {
      focusInputField("next", index, event);
    } else if (key === "Delete") {
      setFieldValue("", index);
    } else if (key === "Backspace") {
      if (index !== 0) {
        setFieldValue("", index);
        if (length === index + 1) {
          if (event.target.value === "") {
            focusInputField("prev", index, event);
          }
        } else {
          focusInputField("prev", index, event);
        }
      }
    } else if (inputValue.length > 0 && key === _value[index]) {
      focusInputField("next", index, event);
    }
  };
  const handleFocus = (event, index) => {
    event.target.select();
    setFocusedIndex(index);
  };
  const handleBlur = () => {
    setFocusedIndex(-1);
  };
  const handlePaste = (event) => {
    event.preventDefault();
    const copyValue = event.clipboardData.getData("text/plain").replace(/[\n\r\s]+/g, "");
    const isValid = validate(copyValue.trim());
    if (isValid) {
      const copyValueToPinArray = createPinArray.createPinArray(length ?? 0, copyValue);
      setValues(copyValueToPinArray);
      focusInputField("next", copyValueToPinArray.length - 2);
    }
  };
  React.useEffect(() => {
    if (_valueToString.length !== length) {
      return;
    }
    onComplete?.(_valueToString);
  }, [length, _valueToString]);
  React.useEffect(() => {
    if (length !== _value.length) {
      setValues(createPinArray.createPinArray(length ?? 0, _value.join("")));
    }
  }, [length, _value]);
  React.useEffect(() => {
    if (value === "") {
      setValues(createPinArray.createPinArray(length ?? 0, value));
    }
  }, [value]);
  React.useEffect(() => {
    if (disabled) {
      setFocusedIndex(-1);
    }
  }, [disabled]);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      Group.Group,
      {
        ...others,
        ...getStyles("root"),
        ref: rootRef,
        role: "group",
        id: uuid,
        gap,
        unstyled,
        wrap: "nowrap",
        variant,
        __size: size,
        dir: "ltr",
        children: _value.map((char, index) => /* @__PURE__ */ React.createElement(
          Input.Input,
          {
            component: "input",
            ...getStyles("pinInput", {
              style: {
                "--input-padding": "0",
                "--input-text-align": "center"
              }
            }),
            classNames: resolvedClassNames,
            styles: resolvedStyles,
            size,
            __staticSelector: "PinInput",
            id: `${uuid}-${index + 1}`,
            key: `${uuid}-${index}`,
            inputMode: inputMode || (type === "number" ? "numeric" : "text"),
            onChange: (event) => handleChange(event, index),
            onKeyDown: (event) => handleKeyDown(event, index),
            onFocus: (event) => handleFocus(event, index),
            onBlur: handleBlur,
            onPaste: handlePaste,
            type: inputType || (mask ? "password" : type === "number" ? "tel" : "text"),
            radius,
            error,
            variant,
            disabled,
            ref: (node) => {
              index === 0 && hooks.assignRef(ref, node);
              inputsRef.current[index] = node;
            },
            autoComplete: oneTimeCode ? "one-time-code" : "off",
            placeholder: focusedIndex === index ? "" : placeholder,
            value: char,
            autoFocus: autoFocus && index === 0,
            unstyled,
            "aria-label": ariaLabel,
            readOnly,
            ...getInputProps?.(index)
          }
        ))
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx("input", { type: "hidden", name, form, value: _valueToString, ...hiddenInputProps })
  ] });
});
PinInput.classes = { ...PinInput_module, ...InputBase.InputBase.classes };
PinInput.displayName = "@mantine/core/PinInput";

exports.PinInput = PinInput;
//# sourceMappingURL=PinInput.cjs.map
