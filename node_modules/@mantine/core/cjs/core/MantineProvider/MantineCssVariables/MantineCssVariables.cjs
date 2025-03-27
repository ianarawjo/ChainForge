'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var convertCssVariables = require('../convert-css-variables/convert-css-variables.cjs');
var Mantine_context = require('../Mantine.context.cjs');
var MantineThemeProvider = require('../MantineThemeProvider/MantineThemeProvider.cjs');
var getMergedVariables = require('./get-merged-variables.cjs');
var removeDefaultVariables = require('./remove-default-variables.cjs');

function getColorSchemeCssVariables(selector) {
  return `
  ${selector}[data-mantine-color-scheme="dark"] { --mantine-color-scheme: dark; }
  ${selector}[data-mantine-color-scheme="light"] { --mantine-color-scheme: light; }
`;
}
function MantineCssVariables({
  cssVariablesSelector,
  deduplicateCssVariables
}) {
  const theme = MantineThemeProvider.useMantineTheme();
  const nonce = Mantine_context.useMantineStyleNonce();
  const generator = Mantine_context.useMantineCssVariablesResolver();
  const mergedVariables = getMergedVariables.getMergedVariables({ theme, generator });
  const shouldCleanVariables = cssVariablesSelector === ":root" && deduplicateCssVariables;
  const cleanedVariables = shouldCleanVariables ? removeDefaultVariables.removeDefaultVariables(mergedVariables) : mergedVariables;
  const css = convertCssVariables.convertCssVariables(cleanedVariables, cssVariablesSelector);
  if (css) {
    return /* @__PURE__ */ jsxRuntime.jsx(
      "style",
      {
        "data-mantine-styles": true,
        nonce: nonce?.(),
        dangerouslySetInnerHTML: {
          __html: `${css}${shouldCleanVariables ? "" : getColorSchemeCssVariables(cssVariablesSelector)}`
        }
      }
    );
  }
  return null;
}
MantineCssVariables.displayName = "@mantine/CssVariables";

exports.MantineCssVariables = MantineCssVariables;
//# sourceMappingURL=MantineCssVariables.cjs.map
