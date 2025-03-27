'use client';
import { keys } from '../../../../core/utils/keys/keys.mjs';
import { em } from '../../../../core/utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import { getSortedBreakpoints } from '../../../../core/utils/get-sorted-breakpoints/get-sorted-breakpoints.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../../../core/MantineProvider/Mantine.context.mjs';
import '../../../../core/MantineProvider/default-theme.mjs';
import '../../../../core/MantineProvider/MantineProvider.mjs';
import '../../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../../core/Box/Box.mjs';
import '../../../../core/DirectionProvider/DirectionProvider.mjs';
import { assignAsideVariables } from '../assign-aside-variables/assign-aside-variables.mjs';
import { assignFooterVariables } from '../assign-footer-variables/assign-footer-variables.mjs';
import { assignHeaderVariables } from '../assign-header-variables/assign-header-variables.mjs';
import { assignNavbarVariables } from '../assign-navbar-variables/assign-navbar-variables.mjs';
import { assignPaddingVariables } from '../assign-padding-variables/assign-padding-variables.mjs';

function getVariables({ navbar, header, footer, aside, padding, theme }) {
  const minMediaStyles = {};
  const maxMediaStyles = {};
  const baseStyles = {};
  assignNavbarVariables({
    baseStyles,
    minMediaStyles,
    maxMediaStyles,
    navbar,
    theme
  });
  assignAsideVariables({
    baseStyles,
    minMediaStyles,
    maxMediaStyles,
    aside,
    theme
  });
  assignHeaderVariables({ baseStyles, minMediaStyles, header });
  assignFooterVariables({ baseStyles, minMediaStyles, footer });
  assignPaddingVariables({ baseStyles, minMediaStyles, padding });
  const minMedia = getSortedBreakpoints(keys(minMediaStyles), theme.breakpoints).map(
    (breakpoint) => ({
      query: `(min-width: ${em(breakpoint.px)})`,
      styles: minMediaStyles[breakpoint.value]
    })
  );
  const maxMedia = getSortedBreakpoints(keys(maxMediaStyles), theme.breakpoints).map(
    (breakpoint) => ({
      query: `(max-width: ${em(breakpoint.px)})`,
      styles: maxMediaStyles[breakpoint.value]
    })
  );
  const media = [...minMedia, ...maxMedia];
  return { baseStyles, media };
}

export { getVariables };
//# sourceMappingURL=get-variables.mjs.map
