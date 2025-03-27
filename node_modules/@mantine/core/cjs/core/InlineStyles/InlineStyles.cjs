'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
var Mantine_context = require('../MantineProvider/Mantine.context.cjs');
require('../MantineProvider/default-theme.cjs');
require('../MantineProvider/MantineProvider.cjs');
require('../MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var stylesToString = require('./styles-to-string/styles-to-string.cjs');

function InlineStyles(props) {
  const nonce = Mantine_context.useMantineStyleNonce();
  return /* @__PURE__ */ jsxRuntime.jsx(
    "style",
    {
      "data-mantine-styles": "inline",
      nonce: nonce?.(),
      dangerouslySetInnerHTML: { __html: stylesToString.stylesToString(props) }
    }
  );
}

exports.InlineStyles = InlineStyles;
//# sourceMappingURL=InlineStyles.cjs.map
