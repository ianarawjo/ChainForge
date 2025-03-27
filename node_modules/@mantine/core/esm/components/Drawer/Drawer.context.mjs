'use client';
import 'react';
import { createSafeContext } from '../../core/utils/create-safe-context/create-safe-context.mjs';
import 'react/jsx-runtime';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const [DrawerProvider, useDrawerContext] = createSafeContext(
  "Drawer component was not found in tree"
);

export { DrawerProvider, useDrawerContext };
//# sourceMappingURL=Drawer.context.mjs.map
