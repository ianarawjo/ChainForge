'use client';
import { jsx } from 'react/jsx-runtime';
import { convertCssVariables } from '../convert-css-variables/convert-css-variables.mjs';
import { useMantineStyleNonce, useMantineCssVariablesResolver } from '../Mantine.context.mjs';
import { useMantineTheme } from '../MantineThemeProvider/MantineThemeProvider.mjs';
import { getMergedVariables } from './get-merged-variables.mjs';
import { removeDefaultVariables } from './remove-default-variables.mjs';

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
  const theme = useMantineTheme();
  const nonce = useMantineStyleNonce();
  const generator = useMantineCssVariablesResolver();
  const mergedVariables = getMergedVariables({ theme, generator });
  const shouldCleanVariables = cssVariablesSelector === ":root" && deduplicateCssVariables;
  const cleanedVariables = shouldCleanVariables ? removeDefaultVariables(mergedVariables) : mergedVariables;
  const css = convertCssVariables(cleanedVariables, cssVariablesSelector);
  if (css) {
    return /* @__PURE__ */ jsx(
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

export { MantineCssVariables };
//# sourceMappingURL=MantineCssVariables.mjs.map
