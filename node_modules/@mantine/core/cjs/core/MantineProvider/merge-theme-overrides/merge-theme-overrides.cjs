'use client';
'use strict';

var deepMerge = require('../../utils/deep-merge/deep-merge.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');

function mergeThemeOverrides(...overrides) {
  return overrides.reduce((acc, override) => deepMerge.deepMerge(acc, override), {});
}

exports.mergeThemeOverrides = mergeThemeOverrides;
//# sourceMappingURL=merge-theme-overrides.cjs.map
