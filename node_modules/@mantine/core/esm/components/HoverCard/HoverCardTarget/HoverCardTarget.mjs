'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, cloneElement } from 'react';
import { isElement } from '../../../core/utils/is-element/is-element.mjs';
import { createEventHandler } from '../../../core/utils/create-event-handler/create-event-handler.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Popover } from '../../Popover/Popover.mjs';
import '../../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../../Popover/PopoverTarget/PopoverTarget.mjs';
import { useHoverCardContext } from '../HoverCard.context.mjs';

const defaultProps = {
  refProp: "ref"
};
const HoverCardTarget = forwardRef((props, ref) => {
  const { children, refProp, eventPropsWrapperName, ...others } = useProps(
    "HoverCardTarget",
    defaultProps,
    props
  );
  if (!isElement(children)) {
    throw new Error(
      "HoverCard.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const ctx = useHoverCardContext();
  const onMouseEnter = createEventHandler(children.props.onMouseEnter, ctx.openDropdown);
  const onMouseLeave = createEventHandler(children.props.onMouseLeave, ctx.closeDropdown);
  const eventListeners = { onMouseEnter, onMouseLeave };
  return /* @__PURE__ */ jsx(Popover.Target, { refProp, ref, ...others, children: cloneElement(
    children,
    eventPropsWrapperName ? { [eventPropsWrapperName]: eventListeners } : eventListeners
  ) });
});
HoverCardTarget.displayName = "@mantine/core/HoverCardTarget";

export { HoverCardTarget };
//# sourceMappingURL=HoverCardTarget.mjs.map
