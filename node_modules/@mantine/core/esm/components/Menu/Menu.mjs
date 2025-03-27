'use client';
import { jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { useUncontrolled, useDidUpdate } from '@mantine/hooks';
import { getContextItemIndex } from '../../core/utils/get-context-item-index/get-context-item-index.mjs';
import { useHovered } from '../../core/utils/use-hovered/use-hovered.mjs';
import 'clsx';
import { useResolvedStylesApi } from '../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { getWithProps } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { useDelayedHover } from '../Floating/use-delayed-hover.mjs';
import '@floating-ui/react';
import '../Floating/FloatingArrow/FloatingArrow.mjs';
import { Popover } from '../Popover/Popover.mjs';
import '../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../Popover/PopoverTarget/PopoverTarget.mjs';
import { MenuContextProvider } from './Menu.context.mjs';
import { MenuDivider } from './MenuDivider/MenuDivider.mjs';
import { MenuDropdown } from './MenuDropdown/MenuDropdown.mjs';
import { MenuItem } from './MenuItem/MenuItem.mjs';
import { MenuLabel } from './MenuLabel/MenuLabel.mjs';
import { MenuTarget } from './MenuTarget/MenuTarget.mjs';
import classes from './Menu.module.css.mjs';

const defaultProps = {
  trapFocus: true,
  closeOnItemClick: true,
  withInitialFocusPlaceholder: true,
  clickOutsideEvents: ["mousedown", "touchstart", "keydown"],
  loop: true,
  trigger: "click",
  openDelay: 0,
  closeDelay: 100,
  menuItemTabIndex: -1
};
function Menu(_props) {
  const props = useProps("Menu", defaultProps, _props);
  const {
    children,
    onOpen,
    onClose,
    opened,
    defaultOpened,
    trapFocus,
    onChange,
    closeOnItemClick,
    loop,
    closeOnEscape,
    trigger,
    openDelay,
    closeDelay,
    classNames,
    styles,
    unstyled,
    variant,
    vars,
    menuItemTabIndex,
    keepMounted,
    withInitialFocusPlaceholder,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Menu",
    classes,
    props,
    classNames,
    styles,
    unstyled
  });
  const [hovered, { setHovered, resetHovered }] = useHovered();
  const [_opened, setOpened] = useUncontrolled({
    value: opened,
    defaultValue: defaultOpened,
    finalValue: false,
    onChange
  });
  const [openedViaClick, setOpenedViaClick] = useState(false);
  const close = () => {
    setOpened(false);
    setOpenedViaClick(false);
    _opened && onClose?.();
  };
  const open = () => {
    setOpened(true);
    !_opened && onOpen?.();
  };
  const toggleDropdown = () => {
    _opened ? close() : open();
  };
  const { openDropdown, closeDropdown } = useDelayedHover({ open, close, closeDelay, openDelay });
  const getItemIndex = (node) => getContextItemIndex("[data-menu-item]", "[data-menu-dropdown]", node);
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  useDidUpdate(() => {
    resetHovered();
  }, [_opened]);
  return /* @__PURE__ */ jsx(
    MenuContextProvider,
    {
      value: {
        getStyles,
        opened: _opened,
        toggleDropdown,
        getItemIndex,
        hovered,
        setHovered,
        openedViaClick,
        setOpenedViaClick,
        closeOnItemClick,
        closeDropdown: trigger === "click" ? close : closeDropdown,
        openDropdown: trigger === "click" ? open : openDropdown,
        closeDropdownImmediately: close,
        loop,
        trigger,
        unstyled,
        menuItemTabIndex,
        withInitialFocusPlaceholder
      },
      children: /* @__PURE__ */ jsx(
        Popover,
        {
          ...others,
          opened: _opened,
          onChange: toggleDropdown,
          defaultOpened,
          trapFocus: keepMounted ? false : trapFocus,
          closeOnEscape,
          __staticSelector: "Menu",
          classNames: resolvedClassNames,
          styles: resolvedStyles,
          unstyled,
          variant,
          keepMounted,
          children
        }
      )
    }
  );
}
Menu.extend = (input) => input;
Menu.withProps = getWithProps(Menu);
Menu.classes = classes;
Menu.displayName = "@mantine/core/Menu";
Menu.Item = MenuItem;
Menu.Label = MenuLabel;
Menu.Dropdown = MenuDropdown;
Menu.Target = MenuTarget;
Menu.Divider = MenuDivider;

export { Menu };
//# sourceMappingURL=Menu.mjs.map
