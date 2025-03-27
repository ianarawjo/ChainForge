'use client';
import 'react';
import 'react/jsx-runtime';
import { getSpacing } from '../../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../../../core/MantineProvider/Mantine.context.mjs';
import '../../../../core/MantineProvider/default-theme.mjs';
import '../../../../core/MantineProvider/MantineProvider.mjs';
import '../../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../../core/Box/Box.mjs';
import '../../../../core/DirectionProvider/DirectionProvider.mjs';

function getPaddingValue(padding) {
  return Number(padding) === 0 ? "0px" : getSpacing(padding);
}

export { getPaddingValue };
//# sourceMappingURL=get-padding-value.mjs.map
