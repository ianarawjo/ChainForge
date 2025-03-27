'use client';
'use strict';

var cssVariablesObjectToString = require('./css-variables-object-to-string.cjs');
var wrapWithSelector = require('./wrap-with-selector.cjs');

function convertCssVariables(input, selector) {
  const sharedVariables = cssVariablesObjectToString.cssVariablesObjectToString(input.variables);
  const shared = sharedVariables ? wrapWithSelector.wrapWithSelector(selector, sharedVariables) : "";
  const dark = cssVariablesObjectToString.cssVariablesObjectToString(input.dark);
  const light = cssVariablesObjectToString.cssVariablesObjectToString(input.light);
  const darkForced = dark ? selector === ":host" ? wrapWithSelector.wrapWithSelector(`${selector}([data-mantine-color-scheme="dark"])`, dark) : wrapWithSelector.wrapWithSelector(`${selector}[data-mantine-color-scheme="dark"]`, dark) : "";
  const lightForced = light ? selector === ":host" ? wrapWithSelector.wrapWithSelector(`${selector}([data-mantine-color-scheme="light"])`, light) : wrapWithSelector.wrapWithSelector(`${selector}[data-mantine-color-scheme="light"]`, light) : "";
  return `${shared}${darkForced}${lightForced}`;
}

exports.convertCssVariables = convertCssVariables;
//# sourceMappingURL=convert-css-variables.cjs.map
