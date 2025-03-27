'use client';
import { getBreakpointValue } from '../get-breakpoint-value/get-breakpoint-value.mjs';

function getSortedBreakpoints(values, breakpoints) {
  const convertedBreakpoints = values.map((breakpoint) => ({
    value: breakpoint,
    px: getBreakpointValue(breakpoint, breakpoints)
  }));
  convertedBreakpoints.sort((a, b) => a.px - b.px);
  return convertedBreakpoints;
}

export { getSortedBreakpoints };
//# sourceMappingURL=get-sorted-breakpoints.mjs.map
