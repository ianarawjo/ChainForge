'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
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

const Dots = forwardRef(({ className, ...others }, ref) => /* @__PURE__ */ jsxs(Box, { component: "span", className: cx(classes.dotsLoader, className), ...others, ref, children: [
  /* @__PURE__ */ jsx("span", { className: classes.dot }),
  /* @__PURE__ */ jsx("span", { className: classes.dot }),
  /* @__PURE__ */ jsx("span", { className: classes.dot })
] }));
Dots.displayName = "@mantine/core/Dots";

export { Dots };
//# sourceMappingURL=Dots.mjs.map
