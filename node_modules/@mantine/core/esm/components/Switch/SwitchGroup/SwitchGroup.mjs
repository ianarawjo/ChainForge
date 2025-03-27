'use client';
import { jsx } from 'react/jsx-runtime';
import { useUncontrolled } from '@mantine/hooks';
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
import { SwitchGroupProvider } from '../SwitchGroup.context.mjs';

const defaultProps = {};
const SwitchGroup = factory((props, ref) => {
  const { value, defaultValue, onChange, size, wrapperProps, children, readOnly, ...others } = useProps("SwitchGroup", defaultProps, props);
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: [],
    onChange
  });
  const handleChange = (event) => {
    const itemValue = event.currentTarget.value;
    !readOnly && setValue(
      _value.includes(itemValue) ? _value.filter((item) => item !== itemValue) : [..._value, itemValue]
    );
  };
  return /* @__PURE__ */ jsx(SwitchGroupProvider, { value: { value: _value, onChange: handleChange, size }, children: /* @__PURE__ */ jsx(
    Input.Wrapper,
    {
      size,
      ref,
      ...wrapperProps,
      ...others,
      labelElement: "div",
      __staticSelector: "SwitchGroup",
      children: /* @__PURE__ */ jsx(InputsGroupFieldset, { role: "group", children })
    }
  ) });
});
SwitchGroup.classes = Input.Wrapper.classes;
SwitchGroup.displayName = "@mantine/core/SwitchGroup";

export { SwitchGroup };
//# sourceMappingURL=SwitchGroup.mjs.map
