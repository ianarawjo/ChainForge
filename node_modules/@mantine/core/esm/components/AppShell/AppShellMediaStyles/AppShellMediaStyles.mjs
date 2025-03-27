'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { useMantineContext } from '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { InlineStyles } from '../../../core/InlineStyles/InlineStyles.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { getVariables } from './get-variables/get-variables.mjs';

function AppShellMediaStyles({
  navbar,
  header,
  aside,
  footer,
  padding
}) {
  const theme = useMantineTheme();
  const ctx = useMantineContext();
  const { media, baseStyles } = getVariables({ navbar, header, footer, aside, padding, theme });
  return /* @__PURE__ */ jsx(InlineStyles, { media, styles: baseStyles, selector: ctx.cssVariablesSelector });
}

export { AppShellMediaStyles };
//# sourceMappingURL=AppShellMediaStyles.mjs.map
