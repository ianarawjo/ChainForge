'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useRef } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { createEventHandler } from '../../../core/utils/create-event-handler/create-event-handler.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Popover } from '../../Popover/Popover.mjs';
import '../../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../../Popover/PopoverTarget/PopoverTarget.mjs';
import { useMenuContext } from '../Menu.context.mjs';
import classes from '../Menu.module.css.mjs';

const defaultProps = {};
const MenuDropdown = factory((props, ref) => {
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    onMouseEnter,
    onMouseLeave,
    onKeyDown,
    children,
    ...others
  } = useProps("MenuDropdown", defaultProps, props);
  const wrapperRef = useRef(null);
  const ctx = useMenuContext();
  const handleKeyDown = createEventHandler(onKeyDown, (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      wrapperRef.current?.querySelectorAll("[data-menu-item]:not(:disabled)")[0]?.focus();
    }
  });
  const handleMouseEnter = createEventHandler(
    onMouseEnter,
    () => (ctx.trigger === "hover" || ctx.trigger === "click-hover") && ctx.openDropdown()
  );
  const handleMouseLeave = createEventHandler(
    onMouseLeave,
    () => (ctx.trigger === "hover" || ctx.trigger === "click-hover") && ctx.closeDropdown()
  );
  return /* @__PURE__ */ jsxs(
    Popover.Dropdown,
    {
      ...others,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      role: "menu",
      "aria-orientation": "vertical",
      ref: useMergedRef(ref, wrapperRef),
      ...ctx.getStyles("dropdown", {
        className,
        style,
        styles,
        classNames,
        withStaticClass: false
      }),
      tabIndex: -1,
      "data-menu-dropdown": true,
      onKeyDown: handleKeyDown,
      children: [
        ctx.withInitialFocusPlaceholder && /* @__PURE__ */ jsx("div", { tabIndex: -1, "data-autofocus": true, "data-mantine-stop-propagation": true, style: { outline: 0 } }),
        children
      ]
    }
  );
});
MenuDropdown.classes = classes;
MenuDropdown.displayName = "@mantine/core/MenuDropdown";

export { MenuDropdown };
//# sourceMappingURL=MenuDropdown.mjs.map
