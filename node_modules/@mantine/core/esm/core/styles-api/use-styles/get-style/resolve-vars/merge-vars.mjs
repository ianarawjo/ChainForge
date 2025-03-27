'use client';
import { filterProps } from '../../../../utils/filter-props/filter-props.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';

function mergeVars(vars) {
  return vars.reduce((acc, current) => {
    if (current) {
      Object.keys(current).forEach((key) => {
        acc[key] = { ...acc[key], ...filterProps(current[key]) };
      });
    }
    return acc;
  }, {});
}

export { mergeVars };
//# sourceMappingURL=merge-vars.mjs.map
