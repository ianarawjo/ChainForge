'use client';
import { jsx } from 'react/jsx-runtime';
import { useId, useUncontrolled } from '@mantine/hooks';
import 'react';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Input } from '../../Input/Input.mjs';
import '../../Input/InputWrapper/InputWrapper.mjs';
import '../../Input/InputDescription/InputDescription.mjs';
import '../../Input/InputError/InputError.mjs';
import '../../Input/InputLabel/InputLabel.mjs';
import '../../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../../Input/InputClearButton/InputClearButton.mjs';
import '../../Input/InputWrapper.context.mjs';
import { InputsGroupFieldset } from '../../InputsGroupFieldset/InputsGroupFieldset.mjs';
import { RadioGroupProvider } from '../RadioGroup.context.mjs';

const defaultProps = {};
const RadioGroup = factory((props, ref) => {
  const { value, defaultValue, onChange, size, wrapperProps, children, name, readOnly, ...others } = useProps("RadioGroup", defaultProps, props);
  const _name = useId(name);
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const handleChange = (event) => !readOnly && setValue(typeof event === "string" ? event : event.currentTarget.value);
  return /* @__PURE__ */ jsx(RadioGroupProvider, { value: { value: _value, onChange: handleChange, size, name: _name }, children: /* @__PURE__ */ jsx(
    Input.Wrapper,
    {
      size,
      ref,
      ...wrapperProps,
      ...others,
      labelElement: "div",
      __staticSelector: "RadioGroup",
      children: /* @__PURE__ */ jsx(InputsGroupFieldset, { role: "radiogroup", children })
    }
  ) });
});
RadioGroup.classes = Input.Wrapper.classes;
RadioGroup.displayName = "@mantine/core/RadioGroup";

export { RadioGroup };
//# sourceMappingURL=RadioGroup.mjs.map
