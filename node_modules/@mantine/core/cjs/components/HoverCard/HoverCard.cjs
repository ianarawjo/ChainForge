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
var useDelayedHover = require('../Floating/use-delayed-hover.cjs');
require('@floating-ui/react');
require('../Floating/FloatingArrow/FloatingArrow.cjs');
var Popover = require('../Popover/Popover.cjs');
require('../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../Popover/PopoverTarget/PopoverTarget.cjs');
var HoverCard_context = require('./HoverCard.context.cjs');
var HoverCardDropdown = require('./HoverCardDropdown/HoverCardDropdown.cjs');
var HoverCardTarget = require('./HoverCardTarget/HoverCardTarget.cjs');

const defaultProps = {
  openDelay: 0,
  closeDelay: 150,
  initiallyOpened: false
};
function HoverCard(props) {
  const { children, onOpen, onClose, openDelay, closeDelay, initiallyOpened, ...others } = useProps.useProps(
    "HoverCard",
    defaultProps,
    props
  );
  const [opened, { open, close }] = hooks.useDisclosure(initiallyOpened, { onClose, onOpen });
  const { openDropdown, closeDropdown } = useDelayedHover.useDelayedHover({ open, close, openDelay, closeDelay });
  return /* @__PURE__ */ jsxRuntime.jsx(HoverCard_context.HoverCardContextProvider, { value: { openDropdown, closeDropdown }, children: /* @__PURE__ */ jsxRuntime.jsx(Popover.Popover, { ...others, opened, __staticSelector: "HoverCard", children }) });
}
HoverCard.displayName = "@mantine/core/HoverCard";
HoverCard.Target = HoverCardTarget.HoverCardTarget;
HoverCard.Dropdown = HoverCardDropdown.HoverCardDropdown;
HoverCard.extend = (input) => input;

exports.HoverCard = HoverCard;
//# sourceMappingURL=HoverCard.cjs.map
