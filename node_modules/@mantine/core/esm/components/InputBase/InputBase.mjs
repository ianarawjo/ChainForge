'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Input } from '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import { useInputProps } from '../Input/use-input-props.mjs';
import '../Input/InputWrapper.context.mjs';

const defaultProps = {
  __staticSelector: "InputBase",
  withAria: true
};
const InputBase = polymorphicFactory((props, ref) => {
  const { inputProps, wrapperProps, ...others } = useInputProps("InputBase", defaultProps, props);
  return /* @__PURE__ */ jsx(Input.Wrapper, { ...wrapperProps, children: /* @__PURE__ */ jsx(Input, { ...inputProps, ...others, ref }) });
});
InputBase.classes = { ...Input.classes, ...Input.Wrapper.classes };
InputBase.displayName = "@mantine/core/InputBase";

export { InputBase };
//# sourceMappingURL=InputBase.mjs.map
