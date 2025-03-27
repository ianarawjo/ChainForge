'use client';
import { jsx } from 'react/jsx-runtime';
import { useDisclosure } from '@mantine/hooks';
import 'react';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { useDelayedHover } from '../Floating/use-delayed-hover.mjs';
import '@floating-ui/react';
import '../Floating/FloatingArrow/FloatingArrow.mjs';
import { Popover } from '../Popover/Popover.mjs';
import '../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../Popover/PopoverTarget/PopoverTarget.mjs';
import { HoverCardContextProvider } from './HoverCard.context.mjs';
import { HoverCardDropdown } from './HoverCardDropdown/HoverCardDropdown.mjs';
import { HoverCardTarget } from './HoverCardTarget/HoverCardTarget.mjs';

const defaultProps = {
  openDelay: 0,
  closeDelay: 150,
  initiallyOpened: false
};
function HoverCard(props) {
  const { children, onOpen, onClose, openDelay, closeDelay, initiallyOpened, ...others } = useProps(
    "HoverCard",
    defaultProps,
    props
  );
  const [opened, { open, close }] = useDisclosure(initiallyOpened, { onClose, onOpen });
  const { openDropdown, closeDropdown } = useDelayedHover({ open, close, openDelay, closeDelay });
  return /* @__PURE__ */ jsx(HoverCardContextProvider, { value: { openDropdown, closeDropdown }, children: /* @__PURE__ */ jsx(Popover, { ...others, opened, __staticSelector: "HoverCard", children }) });
}
HoverCard.displayName = "@mantine/core/HoverCard";
HoverCard.Target = HoverCardTarget;
HoverCard.Dropdown = HoverCardDropdown;
HoverCard.extend = (input) => input;

export { HoverCard };
//# sourceMappingURL=HoverCard.mjs.map
