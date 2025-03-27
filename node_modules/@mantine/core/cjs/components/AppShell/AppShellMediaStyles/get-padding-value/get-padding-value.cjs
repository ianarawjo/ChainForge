'use client';
'use strict';

require('react');
require('react/jsx-runtime');
var getSize = require('../../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
require('clsx');
require('../../../../core/MantineProvider/Mantine.context.cjs');
require('../../../../core/MantineProvider/default-theme.cjs');
require('../../../../core/MantineProvider/MantineProvider.cjs');
require('../../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../../core/Box/Box.cjs');
require('../../../../core/DirectionProvider/DirectionProvider.cjs');

function getPaddingValue(padding) {
  return Number(padding) === 0 ? "0px" : getSize.getSpacing(padding);
}

exports.getPaddingValue = getPaddingValue;
//# sourceMappingURL=get-padding-value.cjs.map
