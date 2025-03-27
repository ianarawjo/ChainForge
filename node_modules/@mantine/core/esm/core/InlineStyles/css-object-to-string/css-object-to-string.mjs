'use client';
import { keys } from '../../utils/keys/keys.mjs';
import { camelToKebabCase } from '../../utils/camel-to-kebab-case/camel-to-kebab-case.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';

function cssObjectToString(css) {
  return keys(css).reduce(
    (acc, rule) => css[rule] !== void 0 ? `${acc}${camelToKebabCase(rule)}:${css[rule]};` : acc,
    ""
  ).trim();
}

export { cssObjectToString };
//# sourceMappingURL=css-object-to-string.mjs.map
