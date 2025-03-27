'use client';
import { useMediaQuery } from '@mantine/hooks';
import { useMantineTheme } from '../MantineThemeProvider/MantineThemeProvider.mjs';

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
  const theme = useMantineTheme();
  const xsMatches = useMediaQuery(`(min-width: ${theme.breakpoints.xs})`, false, options);
  const smMatches = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, false, options);
  const mdMatches = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, false, options);
  const lgMatches = useMediaQuery(`(min-width: ${theme.breakpoints.lg})`, false, options);
  const xlMatches = useMediaQuery(`(min-width: ${theme.breakpoints.xl})`, false, options);
  const breakpoints = [xsMatches, smMatches, mdMatches, lgMatches, xlMatches];
  const firstMatchingBreakpointIndex = getFirstMatchingBreakpoint(breakpoints);
  return getFirstMatchingValue(payload, BREAKPOINTS[firstMatchingBreakpointIndex]);
}

export { useMatches };
//# sourceMappingURL=use-matches.mjs.map
