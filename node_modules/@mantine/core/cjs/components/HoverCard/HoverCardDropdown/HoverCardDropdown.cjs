'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var createEventHandler = require('../../../core/utils/create-event-handler/create-event-handler.cjs');
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
var Popover = require('../../Popover/Popover.cjs');
require('../../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../../Popover/PopoverTarget/PopoverTarget.cjs');
var HoverCard_context = require('../HoverCard.context.cjs');

const defaultProps = {};
function HoverCardDropdown(props) {
  const { children, onMouseEnter, onMouseLeave, ...others } = useProps.useProps(
    "HoverCardDropdown",
    defaultProps,
    props
  );
  const ctx = HoverCard_context.useHoverCardContext();
  const handleMouseEnter = createEventHandler.createEventHandler(onMouseEnter, ctx.openDropdown);
  const handleMouseLeave = createEventHandler.createEventHandler(onMouseLeave, ctx.closeDropdown);
  return /* @__PURE__ */ jsxRuntime.jsx(Popover.Popover.Dropdown, { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, ...others, children });
}
HoverCardDropdown.displayName = "@mantine/core/HoverCardDropdown";

exports.HoverCardDropdown = HoverCardDropdown;
//# sourceMappingURL=HoverCardDropdown.cjs.map
