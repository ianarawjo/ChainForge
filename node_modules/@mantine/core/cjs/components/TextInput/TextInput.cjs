'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var InputBase = require('../InputBase/InputBase.cjs');

const defaultProps = {};
const TextInput = factory.factory((props, ref) => {
  const _props = useProps.useProps("TextInput", defaultProps, props);
  return /* @__PURE__ */ jsxRuntime.jsx(InputBase.InputBase, { component: "input", ref, ..._props, __staticSelector: "TextInput" });
});
TextInput.classes = InputBase.InputBase.classes;
TextInput.displayName = "@mantine/core/TextInput";

exports.TextInput = TextInput;
//# sourceMappingURL=TextInput.cjs.map
