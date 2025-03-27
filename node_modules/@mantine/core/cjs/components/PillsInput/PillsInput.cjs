'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
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
var PillsInput_context = require('./PillsInput.context.cjs');
var PillsInputField = require('./PillsInputField/PillsInputField.cjs');

const defaultProps = {};
const PillsInput = factory.factory((_props, ref) => {
  const props = useProps.useProps("PillsInput", defaultProps, _props);
  const {
    children,
    onMouseDown,
    onClick,
    size,
    disabled,
    __staticSelector,
    error,
    variant,
    ...others
  } = props;
  const fieldRef = React.useRef(null);
  return /* @__PURE__ */ jsxRuntime.jsx(PillsInput_context.PillsInputProvider, { value: { fieldRef, size, disabled, hasError: !!error, variant }, children: /* @__PURE__ */ jsxRuntime.jsx(
    InputBase.InputBase,
    {
      size,
      error,
      variant,
      component: "div",
      ref,
      onMouseDown: (event) => {
        event.preventDefault();
        onMouseDown?.(event);
        fieldRef.current?.focus();
      },
      onClick: (event) => {
        event.preventDefault();
        const fieldset = event.currentTarget.closest("fieldset");
        if (!fieldset?.disabled) {
          fieldRef.current?.focus();
          onClick?.(event);
        }
      },
      ...others,
      multiline: true,
      disabled,
      __staticSelector: __staticSelector || "PillsInput",
      withAria: false,
      children
    }
  ) });
});
PillsInput.displayName = "@mantine/core/PillsInput";
PillsInput.Field = PillsInputField.PillsInputField;

exports.PillsInput = PillsInput;
//# sourceMappingURL=PillsInput.cjs.map
