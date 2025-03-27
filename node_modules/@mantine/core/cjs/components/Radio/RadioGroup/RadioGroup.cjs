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
var RadioGroup_context = require('../RadioGroup.context.cjs');

const defaultProps = {};
const RadioGroup = factory.factory((props, ref) => {
  const { value, defaultValue, onChange, size, wrapperProps, children, name, readOnly, ...others } = useProps.useProps("RadioGroup", defaultProps, props);
  const _name = hooks.useId(name);
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const handleChange = (event) => !readOnly && setValue(typeof event === "string" ? event : event.currentTarget.value);
  return /* @__PURE__ */ jsxRuntime.jsx(RadioGroup_context.RadioGroupProvider, { value: { value: _value, onChange: handleChange, size, name: _name }, children: /* @__PURE__ */ jsxRuntime.jsx(
    Input.Input.Wrapper,
    {
      size,
      ref,
      ...wrapperProps,
      ...others,
      labelElement: "div",
      __staticSelector: "RadioGroup",
      children: /* @__PURE__ */ jsxRuntime.jsx(InputsGroupFieldset.InputsGroupFieldset, { role: "radiogroup", children })
    }
  ) });
});
RadioGroup.classes = Input.Input.Wrapper.classes;
RadioGroup.displayName = "@mantine/core/RadioGroup";

exports.RadioGroup = RadioGroup;
//# sourceMappingURL=RadioGroup.cjs.map
