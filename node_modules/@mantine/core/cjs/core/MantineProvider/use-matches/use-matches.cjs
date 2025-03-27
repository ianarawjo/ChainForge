'use client';
'use strict';

var hooks = require('@mantine/hooks');
var MantineThemeProvider = require('../MantineThemeProvider/MantineThemeProvider.cjs');

const BREAKPOINTS = ["xs", "sm", "md", "lg", "xl"];
function getFirstMatchingValue(value, biggestMatch) {
  if (!biggestMatch) {
    return value.base;
  }
  let index = BREAKPOINTS.indexOf(biggestMatch);
  while (index >= 0) {
    if (BREAKPOINTS[index] in value) {
      return value[BREAKPOINTS[index]];
    }
    index -= 1;
  }
  return value.base;
}
function getFirstMatchingBreakpoint(matches) {
  return matches.findLastIndex((v) => v);
}
function useMatches(payload, options) {
  const theme = MantineThemeProvider.useMantineTheme();
  const xsMatches = hooks.useMediaQuery(`(min-width: ${theme.breakpoints.xs})`, false, options);
  const smMatches = hooks.useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, false, options);
  const mdMatches = hooks.useMediaQuery(`(min-width: ${theme.breakpoints.md})`, false, options);
  const lgMatches = hooks.useMediaQuery(`(min-width: ${theme.breakpoints.lg})`, false, options);
  const xlMatches = hooks.useMediaQuery(`(min-width: ${theme.breakpoints.xl})`, false, options);
  const breakpoints = [xsMatches, smMatches, mdMatches, lgMatches, xlMatches];
  const firstMatchingBreakpointIndex = getFirstMatchingBreakpoint(breakpoints);
  return getFirstMatchingValue(payload, BREAKPOINTS[firstMatchingBreakpointIndex]);
}

exports.useMatches = useMatches;
//# sourceMappingURL=use-matches.cjs.map
