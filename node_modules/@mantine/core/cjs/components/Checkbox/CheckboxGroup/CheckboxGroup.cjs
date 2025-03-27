'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Input = require('../../Input/Input.cjs');
require('../../Input/InputWrapper/InputWrapper.cjs');
require('../../Input/InputDescription/InputDescription.cjs');
require('../../Input/InputError/InputError.cjs');
require('../../Input/InputLabel/InputLabel.cjs');
require('../../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../../Input/InputClearButton/InputClearButton.cjs');
require('../../Input/InputWrapper.context.cjs');
var InputsGroupFieldset = require('../../InputsGroupFieldset/InputsGroupFieldset.cjs');
var CheckboxGroup_context = require('../CheckboxGroup.context.cjs');

const defaultProps = {};
const CheckboxGroup = factory.factory((props, ref) => {
  const { value, defaultValue, onChange, size, wrapperProps, children, readOnly, ...others } = useProps.useProps("CheckboxGroup", defaultProps, props);
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: [],
    onChange
  });
  const handleChange = (event) => {
    const itemValue = typeof event === "string" ? event : event.currentTarget.value;
    !readOnly && setValue(
      _value.includes(itemValue) ? _value.filter((item) => item !== itemValue) : [..._value, itemValue]
    );
  };
  return /* @__PURE__ */ jsxRuntime.jsx(CheckboxGroup_context.CheckboxGroupProvider, { value: { value: _value, onChange: handleChange, size }, children: /* @__PURE__ */ jsxRuntime.jsx(
    Input.Input.Wrapper,
    {
      size,
      ref,
      ...wrapperProps,
      ...others,
      labelElement: "div",
      __staticSelector: "CheckboxGroup",
      children: /* @__PURE__ */ jsxRuntime.jsx(InputsGroupFieldset.InputsGroupFieldset, { role: "group", children })
    }
  ) });
});
CheckboxGroup.classes = Input.Input.Wrapper.classes;
CheckboxGroup.displayName = "@mantine/core/CheckboxGroup";

exports.CheckboxGroup = CheckboxGroup;
//# sourceMappingURL=CheckboxGroup.cjs.map
