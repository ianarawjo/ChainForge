'use client';
'use strict';

var keys = require('../../utils/keys/keys.cjs');
var camelToKebabCase = require('../../utils/camel-to-kebab-case/camel-to-kebab-case.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');

function cssObjectToString(css) {
  return keys.keys(css).reduce(
    (acc, rule) => css[rule] !== void 0 ? `${acc}${camelToKebabCase.camelToKebabCase(rule)}:${css[rule]};` : acc,
    ""
  ).trim();
}

exports.cssObjectToString = cssObjectToString;
//# sourceMappingURL=css-object-to-string.cjs.map
