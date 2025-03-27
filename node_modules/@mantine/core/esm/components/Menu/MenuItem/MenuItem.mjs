'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useRef } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { createScopedKeydownHandler } from '../../../core/utils/create-scoped-keydown-handler/create-scoped-keydown-handler.mjs';
import { createEventHandler } from '../../../core/utils/create-event-handler/create-event-handler.mjs';
import 'clsx';
import { parseThemeColor } from '../../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../../core/factory/polymorphic-factory.mjs';
import { useDirection } from '../../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { useMenuContext } from '../Menu.context.mjs';
import classes from '../Menu.module.css.mjs';

const defaultProps = {};
const MenuItem = polymorphicFactory((props, ref) => {
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
  } = useProps("MenuItem", defaultProps, props);
  const ctx = useMenuContext();
  const theme = useMantineTheme();
  const { dir } = useDirection();
  const itemRef = useRef(null);
  const itemIndex = ctx.getItemIndex(itemRef.current);
  const _others = others;
  const handleMouseLeave = createEventHandler(_others.onMouseLeave, () => ctx.setHovered(-1));
  const handleMouseEnter = createEventHandler(
    _others.onMouseEnter,
    () => ctx.setHovered(ctx.getItemIndex(itemRef.current))
  );
  const handleClick = createEventHandler(_others.onClick, () => {
    if (dataDisabled) {
      return;
    }
    if (typeof closeMenuOnClick === "boolean") {
      closeMenuOnClick && ctx.closeDropdownImmediately();
    } else {
      ctx.closeOnItemClick && ctx.closeDropdownImmediately();
    }
  });
  const handleFocus = createEventHandler(
    _others.onFocus,
    () => ctx.setHovered(ctx.getItemIndex(itemRef.current))
  );
  const colors = color ? theme.variantColorResolver({ color, theme, variant: "light" }) : void 0;
  const parsedThemeColor = color ? parseThemeColor({ color, theme }) : null;
  return /* @__PURE__ */ jsxs(
    UnstyledButton,
    {
      ...others,
      unstyled: ctx.unstyled,
      tabIndex: ctx.menuItemTabIndex,
      onFocus: handleFocus,
      ...ctx.getStyles("item", { className, style, styles, classNames }),
      ref: useMergedRef(itemRef, ref),
      role: "menuitem",
      disabled,
      "data-menu-item": true,
      "data-disabled": disabled || dataDisabled || void 0,
      "data-hovered": ctx.hovered === itemIndex ? true : void 0,
      "data-mantine-stop-propagation": true,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
      onKeyDown: createScopedKeydownHandler({
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
        leftSection && /* @__PURE__ */ jsx("div", { ...ctx.getStyles("itemSection", { styles, classNames }), "data-position": "left", children: leftSection }),
        children && /* @__PURE__ */ jsx("div", { ...ctx.getStyles("itemLabel", { styles, classNames }), children }),
        rightSection && /* @__PURE__ */ jsx("div", { ...ctx.getStyles("itemSection", { styles, classNames }), "data-position": "right", children: rightSection })
      ]
    }
  );
});
MenuItem.classes = classes;
MenuItem.displayName = "@mantine/core/MenuItem";

export { MenuItem };
//# sourceMappingURL=MenuItem.mjs.map
