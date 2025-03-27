'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var getContextItemIndex = require('../../core/utils/get-context-item-index/get-context-item-index.cjs');
var useHovered = require('../../core/utils/use-hovered/use-hovered.cjs');
require('clsx');
var useResolvedStylesApi = require('../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var useDelayedHover = require('../Floating/use-delayed-hover.cjs');
require('@floating-ui/react');
require('../Floating/FloatingArrow/FloatingArrow.cjs');
var Popover = require('../Popover/Popover.cjs');
require('../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../Popover/PopoverTarget/PopoverTarget.cjs');
var Menu_context = require('./Menu.context.cjs');
var MenuDivider = require('./MenuDivider/MenuDivider.cjs');
var MenuDropdown = require('./MenuDropdown/MenuDropdown.cjs');
var MenuItem = require('./MenuItem/MenuItem.cjs');
var MenuLabel = require('./MenuLabel/MenuLabel.cjs');
var MenuTarget = require('./MenuTarget/MenuTarget.cjs');
var Menu_module = require('./Menu.module.css.cjs');

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
  const props = useProps.useProps("Menu", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "Menu",
    classes: Menu_module,
    props,
    classNames,
    styles,
    unstyled
  });
  const [hovered, { setHovered, resetHovered }] = useHovered.useHovered();
  const [_opened, setOpened] = hooks.useUncontrolled({
    value: opened,
    defaultValue: defaultOpened,
    finalValue: false,
    onChange
  });
  const [openedViaClick, setOpenedViaClick] = React.useState(false);
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
  const { openDropdown, closeDropdown } = useDelayedHover.useDelayedHover({ open, close, closeDelay, openDelay });
  const getItemIndex = (node) => getContextItemIndex.getContextItemIndex("[data-menu-item]", "[data-menu-dropdown]", node);
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  hooks.useDidUpdate(() => {
    resetHovered();
  }, [_opened]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Menu_context.MenuContextProvider,
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
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Popover.Popover,
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
Menu.withProps = factory.getWithProps(Menu);
Menu.classes = Menu_module;
Menu.displayName = "@mantine/core/Menu";
Menu.Item = MenuItem.MenuItem;
Menu.Label = MenuLabel.MenuLabel;
Menu.Dropdown = MenuDropdown.MenuDropdown;
Menu.Target = MenuTarget.MenuTarget;
Menu.Divider = MenuDivider.MenuDivider;

exports.Menu = Menu;
//# sourceMappingURL=Menu.cjs.map
