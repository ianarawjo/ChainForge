'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import { useMantineStyleNonce } from '../MantineProvider/Mantine.context.mjs';
import '../MantineProvider/default-theme.mjs';
import '../MantineProvider/MantineProvider.mjs';
import '../MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { stylesToString } from './styles-to-string/styles-to-string.mjs';

function InlineStyles(props) {
  const nonce = useMantineStyleNonce();
  return /* @__PURE__ */ jsx(
    "style",
    {
      "data-mantine-styles": "inline",
      nonce: nonce?.(),
      dangerouslySetInnerHTML: { __html: stylesToString(props) }
    }
  );
}

export { InlineStyles };
//# sourceMappingURL=InlineStyles.mjs.map
