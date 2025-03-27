'use client';
import { jsx } from 'react/jsx-runtime';
import { keys } from '../../core/utils/keys/keys.mjs';
import { filterProps } from '../../core/utils/filter-props/filter-props.mjs';
import 'react';
import { getSpacing } from '../../core/utils/get-size/get-size.mjs';
import { getSortedBreakpoints } from '../../core/utils/get-sorted-breakpoints/get-sorted-breakpoints.mjs';
import { getBaseValue } from '../../core/utils/get-base-value/get-base-value.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { InlineStyles } from '../../core/InlineStyles/InlineStyles.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

function GridVariables({ gutter, selector, breakpoints, type }) {
  const theme = useMantineTheme();
  const _breakpoints = breakpoints || theme.breakpoints;
  const baseStyles = filterProps({
    "--grid-gutter": getSpacing(getBaseValue(gutter))
  });
  const queries = keys(_breakpoints).reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof gutter === "object" && gutter[breakpoint] !== void 0) {
        acc[breakpoint]["--grid-gutter"] = getSpacing(gutter[breakpoint]);
      }
      return acc;
    },
    {}
  );
  const sortedBreakpoints = getSortedBreakpoints(keys(queries), _breakpoints).filter(
    (breakpoint) => keys(queries[breakpoint.value]).length > 0
  );
  const values = sortedBreakpoints.map((breakpoint) => ({
    query: type === "container" ? `mantine-grid (min-width: ${_breakpoints[breakpoint.value]})` : `(min-width: ${_breakpoints[breakpoint.value]})`,
    styles: queries[breakpoint.value]
  }));
  return /* @__PURE__ */ jsx(
    InlineStyles,
    {
      styles: baseStyles,
      media: type === "container" ? void 0 : values,
      container: type === "container" ? values : void 0,
      selector
    }
  );
}

export { GridVariables };
//# sourceMappingURL=GridVariables.mjs.map
