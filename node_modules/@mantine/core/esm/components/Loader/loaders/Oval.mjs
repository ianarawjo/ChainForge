'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import cx from 'clsx';
import '@mantine/hooks';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import classes from '../Loader.module.css.mjs';

const Oval = forwardRef(({ className, ...others }, ref) => /* @__PURE__ */ jsx(Box, { component: "span", className: cx(classes.ovalLoader, className), ...others, ref }));
Oval.displayName = "@mantine/core/Oval";

export { Oval };
//# sourceMappingURL=Oval.mjs.map
