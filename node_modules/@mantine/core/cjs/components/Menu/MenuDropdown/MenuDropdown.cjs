'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var createEventHandler = require('../../../core/utils/create-event-handler/create-event-handler.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Popover = require('../../Popover/Popover.cjs');
require('../../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../../Popover/PopoverTarget/PopoverTarget.cjs');
var Menu_context = require('../Menu.context.cjs');
var Menu_module = require('../Menu.module.css.cjs');

const defaultProps = {};
const MenuDropdown = factory.factory((props, ref) => {
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
  } = useProps.useProps("MenuDropdown", defaultProps, props);
  const wrapperRef = React.useRef(null);
  const ctx = Menu_context.useMenuContext();
  const handleKeyDown = createEventHandler.createEventHandler(onKeyDown, (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      wrapperRef.current?.querySelectorAll("[data-menu-item]:not(:disabled)")[0]?.focus();
    }
  });
  const handleMouseEnter = createEventHandler.createEventHandler(
    onMouseEnter,
    () => (ctx.trigger === "hover" || ctx.trigger === "click-hover") && ctx.openDropdown()
  );
  const handleMouseLeave = createEventHandler.createEventHandler(
    onMouseLeave,
    () => (ctx.trigger === "hover" || ctx.trigger === "click-hover") && ctx.closeDropdown()
  );
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Popover.Popover.Dropdown,
    {
      ...others,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      role: "menu",
      "aria-orientation": "vertical",
      ref: hooks.useMergedRef(ref, wrapperRef),
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
        ctx.withInitialFocusPlaceholder && /* @__PURE__ */ jsxRuntime.jsx("div", { tabIndex: -1, "data-autofocus": true, "data-mantine-stop-propagation": true, style: { outline: 0 } }),
        children
      ]
    }
  );
});
MenuDropdown.classes = Menu_module;
MenuDropdown.displayName = "@mantine/core/MenuDropdown";

exports.MenuDropdown = MenuDropdown;
//# sourceMappingURL=MenuDropdown.cjs.map
