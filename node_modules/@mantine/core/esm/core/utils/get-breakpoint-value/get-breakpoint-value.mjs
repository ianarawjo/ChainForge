'use client';
import { px } from '../units-converters/px.mjs';

function getBreakpointValue(breakpoint, breakpoints) {
  if (breakpoint in breakpoints) {
    return px(breakpoints[breakpoint]);
  }
  return px(breakpoint);
}

export { getBreakpointValue };
//# sourceMappingURL=get-breakpoint-value.mjs.map
