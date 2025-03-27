'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { useState, useRef, useEffect, createElement } from 'react';
import { useId, useUncontrolled, assignRef } from '@mantine/hooks';
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
import { Group } from '../Group/Group.mjs';
import { Input } from '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import '../Input/InputWrapper.context.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';
import { createPinArray } from './create-pin-array/create-pin-array.mjs';
import classes from './PinInput.module.css.mjs';

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
const varsResolver = createVarsResolver((_, { size }) => ({
  root: {
    "--pin-input-size": getSize(size ?? defaultProps.size, "pin-input-size")
  }
}));
const PinInput = factory((props, ref) => {
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
  } = useProps("PinInput", defaultProps, props);
  const uuid = useId(id);
  const getStyles = useStyles({
    name: "PinInput",
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [_value, setValues] = useUncontrolled({
    value: value ? createPinArray(length ?? 0, value) : void 0,
    defaultValue: defaultValue?.split("").slice(0, length ?? 0),
    finalValue: createPinArray(length ?? 0, ""),
    onChange: typeof onChange === "function" ? (val) => {
      onChange(val.join("").trim());
    } : void 0
  });
  const _valueToString = _value.join("").trim();
  const inputsRef = useRef([]);
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
      setValues(createPinArray(length ?? 0, inputValue));
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
      const copyValueToPinArray = createPinArray(length ?? 0, copyValue);
      setValues(copyValueToPinArray);
      focusInputField("next", copyValueToPinArray.length - 2);
    }
  };
  useEffect(() => {
    if (_valueToString.length !== length) {
      return;
    }
    onComplete?.(_valueToString);
  }, [length, _valueToString]);
  useEffect(() => {
    if (length !== _value.length) {
      setValues(createPinArray(length ?? 0, _value.join("")));
    }
  }, [length, _value]);
  useEffect(() => {
    if (value === "") {
      setValues(createPinArray(length ?? 0, value));
    }
  }, [value]);
  useEffect(() => {
    if (disabled) {
      setFocusedIndex(-1);
    }
  }, [disabled]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      Group,
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
        children: _value.map((char, index) => /* @__PURE__ */ createElement(
          Input,
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
              index === 0 && assignRef(ref, node);
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
    /* @__PURE__ */ jsx("input", { type: "hidden", name, form, value: _valueToString, ...hiddenInputProps })
  ] });
});
PinInput.classes = { ...classes, ...InputBase.classes };
PinInput.displayName = "@mantine/core/PinInput";

export { PinInput };
//# sourceMappingURL=PinInput.mjs.map
