'use client';
'use strict';

var getBreakpointValue = require('../get-breakpoint-value/get-breakpoint-value.cjs');

function getSortedBreakpoints(values, breakpoints) {
  const convertedBreakpoints = values.map((breakpoint) => ({
    value: breakpoint,
    px: getBreakpointValue.getBreakpointValue(breakpoint, breakpoints)
  }));
  convertedBreakpoints.sort((a, b) => a.px - b.px);
  return convertedBreakpoints;
}

exports.getSortedBreakpoints = getSortedBreakpoints;
//# sourceMappingURL=get-sorted-breakpoints.cjs.map
