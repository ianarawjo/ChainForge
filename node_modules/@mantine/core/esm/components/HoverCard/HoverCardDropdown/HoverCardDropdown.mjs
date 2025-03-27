'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
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

const defaultProps = {};
function HoverCardDropdown(props) {
  const { children, onMouseEnter, onMouseLeave, ...others } = useProps(
    "HoverCardDropdown",
    defaultProps,
    props
  );
  const ctx = useHoverCardContext();
  const handleMouseEnter = createEventHandler(onMouseEnter, ctx.openDropdown);
  const handleMouseLeave = createEventHandler(onMouseLeave, ctx.closeDropdown);
  return /* @__PURE__ */ jsx(Popover.Dropdown, { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, ...others, children });
}
HoverCardDropdown.displayName = "@mantine/core/HoverCardDropdown";

export { HoverCardDropdown };
//# sourceMappingURL=HoverCardDropdown.mjs.map
