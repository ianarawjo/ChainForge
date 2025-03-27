'use client';
import { jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { useUncontrolled } from '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';
import { Textarea } from '../Textarea/Textarea.mjs';
import { validateJson } from './validate-json/validate-json.mjs';

const defaultProps = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
};
const JsonInput = factory((props, ref) => {
  const {
    value,
    defaultValue,
    onChange,
    formatOnBlur,
    validationError,
    serialize,
    deserialize,
    onFocus,
    onBlur,
    readOnly,
    error,
    ...others
  } = useProps("JsonInput", defaultProps, props);
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const [valid, setValid] = useState(validateJson(_value, deserialize));
  const handleFocus = (event) => {
    onFocus?.(event);
    setValid(true);
  };
  const handleBlur = (event) => {
    typeof onBlur === "function" && onBlur(event);
    const isValid = validateJson(event.currentTarget.value, deserialize);
    formatOnBlur && !readOnly && isValid && event.currentTarget.value.trim() !== "" && setValue(serialize(deserialize(event.currentTarget.value), null, 2));
    setValid(isValid);
  };
  return /* @__PURE__ */ jsx(
    Textarea,
    {
      value: _value,
      onChange: (event) => setValue(event.currentTarget.value),
      onFocus: handleFocus,
      onBlur: handleBlur,
      ref,
      readOnly,
      ...others,
      autoComplete: "off",
      __staticSelector: "JsonInput",
      error: valid ? error : validationError || true,
      "data-monospace": true
    }
  );
});
JsonInput.classes = InputBase.classes;
JsonInput.displayName = "@mantine/core/JsonInput";

export { JsonInput };
//# sourceMappingURL=JsonInput.mjs.map
