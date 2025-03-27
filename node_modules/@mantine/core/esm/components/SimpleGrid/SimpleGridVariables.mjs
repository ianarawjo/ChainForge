'use client';
import { jsx } from 'react/jsx-runtime';
import { keys } from '../../core/utils/keys/keys.mjs';
import { px } from '../../core/utils/units-converters/px.mjs';
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

function SimpleGridMediaVariables({
  spacing,
  verticalSpacing,
  cols,
  selector
}) {
  const theme = useMantineTheme();
  const _verticalSpacing = verticalSpacing === void 0 ? spacing : verticalSpacing;
  const baseStyles = filterProps({
    "--sg-spacing-x": getSpacing(getBaseValue(spacing)),
    "--sg-spacing-y": getSpacing(getBaseValue(_verticalSpacing)),
    "--sg-cols": getBaseValue(cols)?.toString()
  });
  const queries = keys(theme.breakpoints).reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof spacing === "object" && spacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-x"] = getSpacing(spacing[breakpoint]);
      }
      if (typeof _verticalSpacing === "object" && _verticalSpacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-y"] = getSpacing(_verticalSpacing[breakpoint]);
      }
      if (typeof cols === "object" && cols[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-cols"] = cols[breakpoint];
      }
      return acc;
    },
    {}
  );
  const sortedBreakpoints = getSortedBreakpoints(keys(queries), theme.breakpoints).filter(
    (breakpoint) => keys(queries[breakpoint.value]).length > 0
  );
  const media = sortedBreakpoints.map((breakpoint) => ({
    query: `(min-width: ${theme.breakpoints[breakpoint.value]})`,
    styles: queries[breakpoint.value]
  }));
  return /* @__PURE__ */ jsx(InlineStyles, { styles: baseStyles, media, selector });
}
function getBreakpoints(values) {
  if (typeof values === "object" && values !== null) {
    return keys(values);
  }
  return [];
}
function sortBreakpoints(breakpoints) {
  return breakpoints.sort((a, b) => px(a) - px(b));
}
function getUniqueBreakpoints({
  spacing,
  verticalSpacing,
  cols
}) {
  const breakpoints = Array.from(
    /* @__PURE__ */ new Set([
      ...getBreakpoints(spacing),
      ...getBreakpoints(verticalSpacing),
      ...getBreakpoints(cols)
    ])
  );
  return sortBreakpoints(breakpoints);
}
function SimpleGridContainerVariables({
  spacing,
  verticalSpacing,
  cols,
  selector
}) {
  const _verticalSpacing = verticalSpacing === void 0 ? spacing : verticalSpacing;
  const baseStyles = filterProps({
    "--sg-spacing-x": getSpacing(getBaseValue(spacing)),
    "--sg-spacing-y": getSpacing(getBaseValue(_verticalSpacing)),
    "--sg-cols": getBaseValue(cols)?.toString()
  });
  const uniqueBreakpoints = getUniqueBreakpoints({ spacing, verticalSpacing, cols });
  const queries = uniqueBreakpoints.reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof spacing === "object" && spacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-x"] = getSpacing(spacing[breakpoint]);
      }
      if (typeof _verticalSpacing === "object" && _verticalSpacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-y"] = getSpacing(_verticalSpacing[breakpoint]);
      }
      if (typeof cols === "object" && cols[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-cols"] = cols[breakpoint];
      }
      return acc;
    },
    {}
  );
  const media = uniqueBreakpoints.map((breakpoint) => ({
    query: `simple-grid (min-width: ${breakpoint})`,
    styles: queries[breakpoint]
  }));
  return /* @__PURE__ */ jsx(InlineStyles, { styles: baseStyles, container: media, selector });
}

export { SimpleGridContainerVariables, SimpleGridMediaVariables };
//# sourceMappingURL=SimpleGridVariables.mjs.map
