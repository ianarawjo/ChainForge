'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var keys = require('../../../core/utils/keys/keys.cjs');
var filterProps = require('../../../core/utils/filter-props/filter-props.cjs');
require('react');
var getSortedBreakpoints = require('../../../core/utils/get-sorted-breakpoints/get-sorted-breakpoints.cjs');
var getBaseValue = require('../../../core/utils/get-base-value/get-base-value.cjs');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var InlineStyles = require('../../../core/InlineStyles/InlineStyles.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Grid_context = require('../Grid.context.cjs');

const getColumnFlexBasis = (colSpan, columns) => {
  if (colSpan === "content") {
    return "auto";
  }
  if (colSpan === "auto") {
    return "0rem";
  }
  return colSpan ? `${100 / (columns / colSpan)}%` : void 0;
};
const getColumnMaxWidth = (colSpan, columns, grow) => {
  if (grow || colSpan === "auto") {
    return "100%";
  }
  if (colSpan === "content") {
    return "unset";
  }
  return getColumnFlexBasis(colSpan, columns);
};
const getColumnFlexGrow = (colSpan, grow) => {
  if (!colSpan) {
    return void 0;
  }
  return colSpan === "auto" || grow ? "1" : "auto";
};
const getColumnOffset = (offset, columns) => offset === 0 ? "0" : offset ? `${100 / (columns / offset)}%` : void 0;
function GridColVariables({ span, order, offset, selector }) {
  const theme = MantineThemeProvider.useMantineTheme();
  const ctx = Grid_context.useGridContext();
  const _breakpoints = ctx.breakpoints || theme.breakpoints;
  const baseValue = getBaseValue.getBaseValue(span);
  const baseSpan = baseValue === void 0 ? 12 : getBaseValue.getBaseValue(span);
  const baseStyles = filterProps.filterProps({
    "--col-order": getBaseValue.getBaseValue(order)?.toString(),
    "--col-flex-grow": getColumnFlexGrow(baseSpan, ctx.grow),
    "--col-flex-basis": getColumnFlexBasis(baseSpan, ctx.columns),
    "--col-width": baseSpan === "content" ? "auto" : void 0,
    "--col-max-width": getColumnMaxWidth(baseSpan, ctx.columns, ctx.grow),
    "--col-offset": getColumnOffset(getBaseValue.getBaseValue(offset), ctx.columns)
  });
  const queries = keys.keys(_breakpoints).reduce(
    (acc, breakpoint) => {
      if (!acc[breakpoint]) {
        acc[breakpoint] = {};
      }
      if (typeof order === "object" && order[breakpoint] !== void 0) {
        acc[breakpoint]["--col-order"] = order[breakpoint]?.toString();
      }
      if (typeof span === "object" && span[breakpoint] !== void 0) {
        acc[breakpoint]["--col-flex-grow"] = getColumnFlexGrow(span[breakpoint], ctx.grow);
        acc[breakpoint]["--col-flex-basis"] = getColumnFlexBasis(span[breakpoint], ctx.columns);
        acc[breakpoint]["--col-width"] = span[breakpoint] === "content" ? "auto" : void 0;
        acc[breakpoint]["--col-max-width"] = getColumnMaxWidth(
          span[breakpoint],
          ctx.columns,
          ctx.grow
        );
      }
      if (typeof offset === "object" && offset[breakpoint] !== void 0) {
        acc[breakpoint]["--col-offset"] = getColumnOffset(offset[breakpoint], ctx.columns);
      }
      return acc;
    },
    {}
  );
  const sortedBreakpoints = getSortedBreakpoints.getSortedBreakpoints(keys.keys(queries), _breakpoints).filter(
    (breakpoint) => keys.keys(queries[breakpoint.value]).length > 0
  );
  const values = sortedBreakpoints.map((breakpoint) => ({
    query: ctx.type === "container" ? `mantine-grid (min-width: ${_breakpoints[breakpoint.value]})` : `(min-width: ${_breakpoints[breakpoint.value]})`,
    styles: queries[breakpoint.value]
  }));
  return /* @__PURE__ */ jsxRuntime.jsx(
    InlineStyles.InlineStyles,
    {
      styles: baseStyles,
      media: ctx.type === "container" ? void 0 : values,
      container: ctx.type === "container" ? values : void 0,
      selector
    }
  );
}

exports.GridColVariables = GridColVariables;
//# sourceMappingURL=GridColVariables.cjs.map
