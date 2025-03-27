'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var createScopedKeydownHandler = require('../../../core/utils/create-scoped-keydown-handler/create-scoped-keydown-handler.cjs');
var createEventHandler = require('../../../core/utils/create-event-handler/create-event-handler.cjs');
require('clsx');
var parseThemeColor = require('../../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var polymorphicFactory = require('../../../core/factory/polymorphic-factory.cjs');
var DirectionProvider = require('../../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var Menu_context = require('../Menu.context.cjs');
var Menu_module = require('../Menu.module.css.cjs');

const defaultProps = {};
const MenuItem = polymorphicFactory.polymorphicFactory((props, ref) => {
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    color,
    closeMenuOnClick,
    leftSection,
    rightSection,
    children,
    disabled,
    "data-disabled": dataDisabled,
    ...others
  } = useProps.useProps("MenuItem", defaultProps, props);
  const ctx = Menu_context.useMenuContext();
  const theme = MantineThemeProvider.useMantineTheme();
  const { dir } = DirectionProvider.useDirection();
  const itemRef = React.useRef(null);
  const itemIndex = ctx.getItemIndex(itemRef.current);
  const _others = others;
  const handleMouseLeave = createEventHandler.createEventHandler(_others.onMouseLeave, () => ctx.setHovered(-1));
  const handleMouseEnter = createEventHandler.createEventHandler(
    _others.onMouseEnter,
    () => ctx.setHovered(ctx.getItemIndex(itemRef.current))
  );
  const handleClick = createEventHandler.createEventHandler(_others.onClick, () => {
    if (dataDisabled) {
      return;
    }
    if (typeof closeMenuOnClick === "boolean") {
      closeMenuOnClick && ctx.closeDropdownImmediately();
    } else {
      ctx.closeOnItemClick && ctx.closeDropdownImmediately();
    }
  });
  const handleFocus = createEventHandler.createEventHandler(
    _others.onFocus,
    () => ctx.setHovered(ctx.getItemIndex(itemRef.current))
  );
  const colors = color ? theme.variantColorResolver({ color, theme, variant: "light" }) : void 0;
  const parsedThemeColor = color ? parseThemeColor.parseThemeColor({ color, theme }) : null;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ...others,
      unstyled: ctx.unstyled,
      tabIndex: ctx.menuItemTabIndex,
      onFocus: handleFocus,
      ...ctx.getStyles("item", { className, style, styles, classNames }),
      ref: hooks.useMergedRef(itemRef, ref),
      role: "menuitem",
      disabled,
      "data-menu-item": true,
      "data-disabled": disabled || dataDisabled || void 0,
      "data-hovered": ctx.hovered === itemIndex ? true : void 0,
      "data-mantine-stop-propagation": true,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
      onKeyDown: createScopedKeydownHandler.createScopedKeydownHandler({
        siblingSelector: "[data-menu-item]:not([data-disabled])",
        parentSelector: "[data-menu-dropdown]",
        activateOnFocus: false,
        loop: ctx.loop,
        dir,
        orientation: "vertical",
        onKeyDown: _others.onKeyDown
      }),
      __vars: {
        "--menu-item-color": parsedThemeColor?.isThemeColor && parsedThemeColor?.shade === void 0 ? `var(--mantine-color-${parsedThemeColor.color}-6)` : colors?.color,
        "--menu-item-hover": colors?.hover
      },
      children: [
        leftSection && /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("itemSection", { styles, classNames }), "data-position": "left", children: leftSection }),
        children && /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("itemLabel", { styles, classNames }), children }),
        rightSection && /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("itemSection", { styles, classNames }), "data-position": "right", children: rightSection })
      ]
    }
  );
});
MenuItem.classes = Menu_module;
MenuItem.displayName = "@mantine/core/MenuItem";

exports.MenuItem = MenuItem;
//# sourceMappingURL=MenuItem.cjs.map
