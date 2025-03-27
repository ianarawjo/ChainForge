'use client';
'use strict';

require('react');
require('react/jsx-runtime');
var createOptionalContext = require('../../core/utils/create-optional-context/create-optional-context.cjs');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

const [InputWrapperProvider, useInputWrapperContext] = createOptionalContext.createOptionalContext({
  offsetBottom: false,
  offsetTop: false,
  describedBy: void 0,
  getStyles: null,
  inputId: void 0,
  labelId: void 0
});

exports.InputWrapperProvider = InputWrapperProvider;
exports.useInputWrapperContext = useInputWrapperContext;
//# sourceMappingURL=InputWrapper.context.cjs.map
