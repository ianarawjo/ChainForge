'use client';
import { keys } from '../../utils/keys/keys.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import { DEFAULT_THEME } from '../default-theme.mjs';
import { defaultCssVariablesResolver } from './default-css-variables-resolver.mjs';

const defaultCssVariables = defaultCssVariablesResolver(DEFAULT_THEME);
function removeDefaultVariables(input) {
  const cleaned = {
    variables: {},
    light: {},
    dark: {}
  };
  keys(input.variables).forEach((key) => {
    if (defaultCssVariables.variables[key] !== input.variables[key]) {
      cleaned.variables[key] = input.variables[key];
    }
  });
  keys(input.light).forEach((key) => {
    if (defaultCssVariables.light[key] !== input.light[key]) {
      cleaned.light[key] = input.light[key];
    }
  });
  keys(input.dark).forEach((key) => {
    if (defaultCssVariables.dark[key] !== input.dark[key]) {
      cleaned.dark[key] = input.dark[key];
    }
  });
  return cleaned;
}

export { removeDefaultVariables };
//# sourceMappingURL=remove-default-variables.mjs.map
