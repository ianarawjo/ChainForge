'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var InputWrapper_context = require('../Input/InputWrapper.context.cjs');

function InputsGroupFieldset({ children, role }) {
  const ctx = InputWrapper_context.useInputWrapperContext();
  if (!ctx) {
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { role, "aria-labelledby": ctx.labelId, "aria-describedby": ctx.describedBy, children });
}

exports.InputsGroupFieldset = InputsGroupFieldset;
//# sourceMappingURL=InputsGroupFieldset.cjs.map
