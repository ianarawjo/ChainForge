'use client';
'use strict';

var deepMerge = require('../../utils/deep-merge/deep-merge.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var defaultCssVariablesResolver = require('./default-css-variables-resolver.cjs');

function getMergedVariables({ theme, generator }) {
  const defaultResolver = defaultCssVariablesResolver.defaultCssVariablesResolver(theme);
  const providerGenerator = generator?.(theme);
  return providerGenerator ? deepMerge.deepMerge(defaultResolver, providerGenerator) : defaultResolver;
}

exports.getMergedVariables = getMergedVariables;
//# sourceMappingURL=get-merged-variables.cjs.map
