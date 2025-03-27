'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var react = require('@floating-ui/react');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var TooltipGroup_context = require('./TooltipGroup.context.cjs');

const defaultProps = {
  openDelay: 0,
  closeDelay: 0
};
function TooltipGroup(props) {
  const { openDelay, closeDelay, children } = useProps.useProps("TooltipGroup", defaultProps, props);
  return /* @__PURE__ */ jsxRuntime.jsx(TooltipGroup_context.TooltipGroupProvider, { value: true, children: /* @__PURE__ */ jsxRuntime.jsx(react.FloatingDelayGroup, { delay: { open: openDelay, close: closeDelay }, children }) });
}
TooltipGroup.displayName = "@mantine/core/TooltipGroup";
TooltipGroup.extend = (c) => c;

exports.TooltipGroup = TooltipGroup;
//# sourceMappingURL=TooltipGroup.cjs.map
