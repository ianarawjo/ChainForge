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
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

const defaultProps = {};
const Space = factory.factory((props, ref) => {
  const { w, h, miw, mih, ...others } = useProps.useProps("Space", defaultProps, props);
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...others, w, miw: miw ?? w, h, mih: mih ?? h });
});
Space.displayName = "@mantine/core/Space";

exports.Space = Space;
//# sourceMappingURL=Space.cjs.map
