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

const [RadioGroupProvider, useRadioGroupContext] = createOptionalContext.createOptionalContext();

exports.RadioGroupProvider = RadioGroupProvider;
exports.useRadioGroupContext = useRadioGroupContext;
//# sourceMappingURL=RadioGroup.context.cjs.map
