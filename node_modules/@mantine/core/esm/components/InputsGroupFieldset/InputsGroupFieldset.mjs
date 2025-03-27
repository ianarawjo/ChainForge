'use client';
import { jsx, Fragment } from 'react/jsx-runtime';
import '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { useInputWrapperContext } from '../Input/InputWrapper.context.mjs';

function InputsGroupFieldset({ children, role }) {
  const ctx = useInputWrapperContext();
  if (!ctx) {
    return /* @__PURE__ */ jsx(Fragment, { children });
  }
  return /* @__PURE__ */ jsx("div", { role, "aria-labelledby": ctx.labelId, "aria-describedby": ctx.describedBy, children });
}

export { InputsGroupFieldset };
//# sourceMappingURL=InputsGroupFieldset.mjs.map
