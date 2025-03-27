'use client';
import { jsx } from 'react/jsx-runtime';
import { keys } from '../../utils/keys/keys.mjs';
import { px } from '../../utils/units-converters/px.mjs';
import { em } from '../../utils/units-converters/rem.mjs';
import 'react';
import '@mantine/hooks';
import { useMantineStyleNonce } from '../Mantine.context.mjs';
import { useMantineTheme } from '../MantineThemeProvider/MantineThemeProvider.mjs';

function MantineClasses() {
  const theme = useMantineTheme();
  const nonce = useMantineStyleNonce();
  const classes = keys(theme.breakpoints).reduce((acc, breakpoint) => {
    const isPxBreakpoint = theme.breakpoints[breakpoint].includes("px");
    const pxValue = px(theme.breakpoints[breakpoint]);
    const maxWidthBreakpoint = isPxBreakpoint ? `${pxValue - 0.1}px` : em(pxValue - 0.1);
    const minWidthBreakpoint = isPxBreakpoint ? `${pxValue}px` : em(pxValue);
    return `${acc}@media (max-width: ${maxWidthBreakpoint}) {.mantine-visible-from-${breakpoint} {display: none !important;}}@media (min-width: ${minWidthBreakpoint}) {.mantine-hidden-from-${breakpoint} {display: none !important;}}`;
  }, "");
  return /* @__PURE__ */ jsx(
    "style",
    {
      "data-mantine-styles": "classes",
      nonce: nonce?.(),
      dangerouslySetInnerHTML: { __html: classes }
    }
  );
}

export { MantineClasses };
//# sourceMappingURL=MantineClasses.mjs.map
