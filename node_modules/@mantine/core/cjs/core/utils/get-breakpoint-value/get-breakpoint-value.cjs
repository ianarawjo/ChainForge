'use client';
'use strict';

var px = require('../units-converters/px.cjs');

function getBreakpointValue(breakpoint, breakpoints) {
  if (breakpoint in breakpoints) {
    return px.px(breakpoints[breakpoint]);
  }
  return px.px(breakpoint);
}

exports.getBreakpointValue = getBreakpointValue;
//# sourceMappingURL=get-breakpoint-value.cjs.map
