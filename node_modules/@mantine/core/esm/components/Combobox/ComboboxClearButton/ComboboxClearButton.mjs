'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { Input } from '../../Input/Input.mjs';
import '../../Input/InputWrapper/InputWrapper.mjs';
import '../../Input/InputDescription/InputDescription.mjs';
import '../../Input/InputError/InputError.mjs';
import '../../Input/InputLabel/InputLabel.mjs';
import '../../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../../Input/InputClearButton/InputClearButton.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import '../../Input/InputWrapper.context.mjs';

const ComboboxClearButton = forwardRef(
  ({ size, onMouseDown, onClick, onClear, ...others }, ref) => /* @__PURE__ */ jsx(
    Input.ClearButton,
    {
      ref,
      tabIndex: -1,
      "aria-hidden": true,
      ...others,
      onMouseDown: (event) => {
        event.preventDefault();
        onMouseDown?.(event);
      },
      onClick: (event) => {
        onClear();
        onClick?.(event);
      }
    }
  )
);
ComboboxClearButton.displayName = "@mantine/core/ComboboxClearButton";

export { ComboboxClearButton };
//# sourceMappingURL=ComboboxClearButton.mjs.map
