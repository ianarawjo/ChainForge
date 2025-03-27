'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var InputBase = require('../InputBase/InputBase.cjs');
var Textarea = require('../Textarea/Textarea.cjs');
var validateJson = require('./validate-json/validate-json.cjs');

const defaultProps = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
};
const JsonInput = factory.factory((props, ref) => {
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
  } = useProps.useProps("JsonInput", defaultProps, props);
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const [valid, setValid] = React.useState(validateJson.validateJson(_value, deserialize));
  const handleFocus = (event) => {
    onFocus?.(event);
    setValid(true);
  };
  const handleBlur = (event) => {
    typeof onBlur === "function" && onBlur(event);
    const isValid = validateJson.validateJson(event.currentTarget.value, deserialize);
    formatOnBlur && !readOnly && isValid && event.currentTarget.value.trim() !== "" && setValue(serialize(deserialize(event.currentTarget.value), null, 2));
    setValid(isValid);
  };
  return /* @__PURE__ */ jsxRuntime.jsx(
    Textarea.Textarea,
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
JsonInput.classes = InputBase.InputBase.classes;
JsonInput.displayName = "@mantine/core/JsonInput";

exports.JsonInput = JsonInput;
//# sourceMappingURL=JsonInput.cjs.map
