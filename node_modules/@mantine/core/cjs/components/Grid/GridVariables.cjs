'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var keys = require('../../core/utils/keys/keys.cjs');
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

function GridVariables({ gutter, selector, breakpoints, type }) {
  const theme = MantineThemeProvider.useMantineTheme();
  const _breakpoints = breakpoints || theme.breakpoints;
  const baseStyles = filterProps.filterProps({
    "--grid-gutter": getSize.getSpacing(getBaseValue.getBaseValue(gutter))
  });
  const queries = keys.keys(_breakpoints).reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof gutter === "object" && gutter[breakpoint] !== void 0) {
        acc[breakpoint]["--grid-gutter"] = getSize.getSpacing(gutter[breakpoint]);
      }
      return acc;
    },
    {}
  );
  const sortedBreakpoints = getSortedBreakpoints.getSortedBreakpoints(keys.keys(queries), _breakpoints).filter(
    (breakpoint) => keys.keys(queries[breakpoint.value]).length > 0
  );
  const values = sortedBreakpoints.map((breakpoint) => ({
    query: type === "container" ? `mantine-grid (min-width: ${_breakpoints[breakpoint.value]})` : `(min-width: ${_breakpoints[breakpoint.value]})`,
    styles: queries[breakpoint.value]
  }));
  return /* @__PURE__ */ jsxRuntime.jsx(
    InlineStyles.InlineStyles,
    {
      styles: baseStyles,
      media: type === "container" ? void 0 : values,
      container: type === "container" ? values : void 0,
      selector
    }
  );
}

exports.GridVariables = GridVariables;
//# sourceMappingURL=GridVariables.cjs.map
