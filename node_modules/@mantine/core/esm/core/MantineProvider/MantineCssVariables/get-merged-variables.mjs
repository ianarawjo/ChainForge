'use client';
import { deepMerge } from '../../utils/deep-merge/deep-merge.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import { defaultCssVariablesResolver } from './default-css-variables-resolver.mjs';

function getMergedVariables({ theme, generator }) {
  const defaultResolver = defaultCssVariablesResolver(theme);
  const providerGenerator = generator?.(theme);
  return providerGenerator ? deepMerge(defaultResolver, providerGenerator) : defaultResolver;
}

export { getMergedVariables };
//# sourceMappingURL=get-merged-variables.mjs.map
