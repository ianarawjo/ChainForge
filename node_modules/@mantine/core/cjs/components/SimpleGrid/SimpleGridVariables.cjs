'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var keys = require('../../core/utils/keys/keys.cjs');
var px = require('../../core/utils/units-converters/px.cjs');
var filterProps = require('../../core/utils/filter-props/filter-props.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var getSortedBreakpoints = require('../../core/utils/get-sorted-breakpoints/get-sorted-breakpoints.cjs');
var getBaseValue = require('../../core/utils/get-base-value/get-base-value.cjs');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var InlineStyles = require('../../core/InlineStyles/InlineStyles.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

function SimpleGridMediaVariables({
  spacing,
  verticalSpacing,
  cols,
  selector
}) {
  const theme = MantineThemeProvider.useMantineTheme();
  const _verticalSpacing = verticalSpacing === void 0 ? spacing : verticalSpacing;
  const baseStyles = filterProps.filterProps({
    "--sg-spacing-x": getSize.getSpacing(getBaseValue.getBaseValue(spacing)),
    "--sg-spacing-y": getSize.getSpacing(getBaseValue.getBaseValue(_verticalSpacing)),
    "--sg-cols": getBaseValue.getBaseValue(cols)?.toString()
  });
  const queries = keys.keys(theme.breakpoints).reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof spacing === "object" && spacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-x"] = getSize.getSpacing(spacing[breakpoint]);
      }
      if (typeof _verticalSpacing === "object" && _verticalSpacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-y"] = getSize.getSpacing(_verticalSpacing[breakpoint]);
      }
      if (typeof cols === "object" && cols[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-cols"] = cols[breakpoint];
      }
      return acc;
    },
    {}
  );
  const sortedBreakpoints = getSortedBreakpoints.getSortedBreakpoints(keys.keys(queries), theme.breakpoints).filter(
    (breakpoint) => keys.keys(queries[breakpoint.value]).length > 0
  );
  const media = sortedBreakpoints.map((breakpoint) => ({
    query: `(min-width: ${theme.breakpoints[breakpoint.value]})`,
    styles: queries[breakpoint.value]
  }));
  return /* @__PURE__ */ jsxRuntime.jsx(InlineStyles.InlineStyles, { styles: baseStyles, media, selector });
}
function getBreakpoints(values) {
  if (typeof values === "object" && values !== null) {
    return keys.keys(values);
  }
  return [];
}
function sortBreakpoints(breakpoints) {
  return breakpoints.sort((a, b) => px.px(a) - px.px(b));
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
  const baseStyles = filterProps.filterProps({
    "--sg-spacing-x": getSize.getSpacing(getBaseValue.getBaseValue(spacing)),
    "--sg-spacing-y": getSize.getSpacing(getBaseValue.getBaseValue(_verticalSpacing)),
    "--sg-cols": getBaseValue.getBaseValue(cols)?.toString()
  });
  const uniqueBreakpoints = getUniqueBreakpoints({ spacing, verticalSpacing, cols });
  const queries = uniqueBreakpoints.reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof spacing === "object" && spacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-x"] = getSize.getSpacing(spacing[breakpoint]);
      }
      if (typeof _verticalSpacing === "object" && _verticalSpacing[breakpoint] !== void 0) {
        acc[breakpoint]["--sg-spacing-y"] = getSize.getSpacing(_verticalSpacing[breakpoint]);
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
  return /* @__PURE__ */ jsxRuntime.jsx(InlineStyles.InlineStyles, { styles: baseStyles, container: media, selector });
}

exports.SimpleGridContainerVariables = SimpleGridContainerVariables;
exports.SimpleGridMediaVariables = SimpleGridMediaVariables;
//# sourceMappingURL=SimpleGridVariables.cjs.map
