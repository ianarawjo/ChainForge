'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var Input = require('../../Input/Input.cjs');
require('../../Input/InputWrapper/InputWrapper.cjs');
require('../../Input/InputDescription/InputDescription.cjs');
require('../../Input/InputError/InputError.cjs');
require('../../Input/InputLabel/InputLabel.cjs');
require('../../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../../Input/InputClearButton/InputClearButton.cjs');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
require('../../Input/InputWrapper.context.cjs');

const ComboboxClearButton = React.forwardRef(
  ({ size, onMouseDown, onClick, onClear, ...others }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
    Input.Input.ClearButton,
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

exports.ComboboxClearButton = ComboboxClearButton;
//# sourceMappingURL=ComboboxClearButton.cjs.map
