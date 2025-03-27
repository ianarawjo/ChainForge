'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var isElement = require('../../../core/utils/is-element/is-element.cjs');
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

const defaultProps = {
  refProp: "ref"
};
const HoverCardTarget = React.forwardRef((props, ref) => {
  const { children, refProp, eventPropsWrapperName, ...others } = useProps.useProps(
    "HoverCardTarget",
    defaultProps,
    props
  );
  if (!isElement.isElement(children)) {
    throw new Error(
      "HoverCard.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const ctx = HoverCard_context.useHoverCardContext();
  const onMouseEnter = createEventHandler.createEventHandler(children.props.onMouseEnter, ctx.openDropdown);
  const onMouseLeave = createEventHandler.createEventHandler(children.props.onMouseLeave, ctx.closeDropdown);
  const eventListeners = { onMouseEnter, onMouseLeave };
  return /* @__PURE__ */ jsxRuntime.jsx(Popover.Popover.Target, { refProp, ref, ...others, children: React.cloneElement(
    children,
    eventPropsWrapperName ? { [eventPropsWrapperName]: eventListeners } : eventListeners
  ) });
});
HoverCardTarget.displayName = "@mantine/core/HoverCardTarget";

exports.HoverCardTarget = HoverCardTarget;
//# sourceMappingURL=HoverCardTarget.cjs.map
