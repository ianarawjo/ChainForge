'use client';
import 'react';
import 'react/jsx-runtime';
import { createOptionalContext } from '../../core/utils/create-optional-context/create-optional-context.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const [ColorPickerProvider, useColorPickerContext] = createOptionalContext(null);

export { ColorPickerProvider, useColorPickerContext };
//# sourceMappingURL=ColorPicker.context.mjs.map
