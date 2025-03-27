'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

const defaultProps = {
  timeout: 1e3
};
function CopyButton(props) {
  const { children, timeout, value, ...others } = useProps.useProps("CopyButton", defaultProps, props);
  const clipboard = hooks.useClipboard({ timeout });
  const copy = () => clipboard.copy(value);
  return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: children({ copy, copied: clipboard.copied, ...others }) });
}
CopyButton.displayName = "@mantine/core/CopyButton";

exports.CopyButton = CopyButton;
//# sourceMappingURL=CopyButton.cjs.map
