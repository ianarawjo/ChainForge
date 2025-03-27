'use client';
import { deepMerge } from '../../utils/deep-merge/deep-merge.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';

function mergeThemeOverrides(...overrides) {
  return overrides.reduce((acc, override) => deepMerge(acc, override), {});
}

export { mergeThemeOverrides };
//# sourceMappingURL=merge-theme-overrides.mjs.map
