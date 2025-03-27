'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Input = require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
var useInputProps = require('../Input/use-input-props.cjs');
require('../Input/InputWrapper.context.cjs');

const defaultProps = {
  __staticSelector: "InputBase",
  withAria: true
};
const InputBase = polymorphicFactory.polymorphicFactory((props, ref) => {
  const { inputProps, wrapperProps, ...others } = useInputProps.useInputProps("InputBase", defaultProps, props);
  return /* @__PURE__ */ jsxRuntime.jsx(Input.Input.Wrapper, { ...wrapperProps, children: /* @__PURE__ */ jsxRuntime.jsx(Input.Input, { ...inputProps, ...others, ref }) });
});
InputBase.classes = { ...Input.Input.classes, ...Input.Input.Wrapper.classes };
InputBase.displayName = "@mantine/core/InputBase";

exports.InputBase = InputBase;
//# sourceMappingURL=InputBase.cjs.map
