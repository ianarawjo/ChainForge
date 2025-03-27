'use client';
import { jsx } from 'react/jsx-runtime';
import { useRef } from 'react';
import '@mantine/hooks';
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
import { PillsInputProvider } from './PillsInput.context.mjs';
import { PillsInputField } from './PillsInputField/PillsInputField.mjs';

const defaultProps = {};
const PillsInput = factory((_props, ref) => {
  const props = useProps("PillsInput", defaultProps, _props);
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
  const fieldRef = useRef(null);
  return /* @__PURE__ */ jsx(PillsInputProvider, { value: { fieldRef, size, disabled, hasError: !!error, variant }, children: /* @__PURE__ */ jsx(
    InputBase,
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
PillsInput.Field = PillsInputField;

export { PillsInput };
//# sourceMappingURL=PillsInput.mjs.map
