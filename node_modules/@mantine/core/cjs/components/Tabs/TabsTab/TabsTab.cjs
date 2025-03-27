'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var createScopedKeydownHandler = require('../../../core/utils/create-scoped-keydown-handler/create-scoped-keydown-handler.cjs');
require('@mantine/hooks');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
var DirectionProvider = require('../../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var Tabs_context = require('../Tabs.context.cjs');
var Tabs_module = require('../Tabs.module.css.cjs');

const defaultProps = {};
const TabsTab = factory.factory((_props, ref) => {
  const props = useProps.useProps("TabsTab", defaultProps, _props);
  const {
    className,
    children,
    rightSection,
    leftSection,
    value,
    onClick,
    onKeyDown,
    disabled,
    color,
    style,
    classNames,
    styles,
    vars,
    mod,
    tabIndex,
    ...others
  } = props;
  const theme = MantineThemeProvider.useMantineTheme();
  const { dir } = DirectionProvider.useDirection();
  const ctx = Tabs_context.useTabsContext();
  const active = value === ctx.value;
  const activateTab = (event) => {
    ctx.onChange(ctx.allowTabDeactivation ? value === ctx.value ? null : value : value);
    onClick?.(event);
  };
  const stylesApiProps = { classNames, styles, props };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ...others,
      ...ctx.getStyles("tab", { className, style, variant: ctx.variant, ...stylesApiProps }),
      disabled,
      unstyled: ctx.unstyled,
      variant: ctx.variant,
      mod: [
        {
          active,
          disabled,
          orientation: ctx.orientation,
          inverted: ctx.inverted,
          placement: ctx.orientation === "vertical" && ctx.placement
        },
        mod
      ],
      ref,
      role: "tab",
      id: ctx.getTabId(value),
      "aria-selected": active,
      tabIndex: tabIndex !== void 0 ? tabIndex : active || ctx.value === null ? 0 : -1,
      "aria-controls": ctx.getPanelId(value),
      onClick: activateTab,
      __vars: { "--tabs-color": color ? getThemeColor.getThemeColor(color, theme) : void 0 },
      onKeyDown: createScopedKeydownHandler.createScopedKeydownHandler({
        siblingSelector: '[role="tab"]',
        parentSelector: '[role="tablist"]',
        activateOnFocus: ctx.activateTabWithKeyboard,
        loop: ctx.loop,
        orientation: ctx.orientation || "horizontal",
        dir,
        onKeyDown
      }),
      children: [
        leftSection && /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("tabSection", stylesApiProps), "data-position": "left", children: leftSection }),
        children && /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("tabLabel", stylesApiProps), children }),
        rightSection && /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("tabSection", stylesApiProps), "data-position": "right", children: rightSection })
      ]
    }
  );
});
TabsTab.classes = Tabs_module;
TabsTab.displayName = "@mantine/core/TabsTab";

exports.TabsTab = TabsTab;
//# sourceMappingURL=TabsTab.cjs.map
