'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
var getSafeId = require('../../core/utils/get-safe-id/get-safe-id.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var getContrastColor = require('../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Tabs_context = require('./Tabs.context.cjs');
var TabsList = require('./TabsList/TabsList.cjs');
var TabsPanel = require('./TabsPanel/TabsPanel.cjs');
var TabsTab = require('./TabsTab/TabsTab.cjs');
var Tabs_module = require('./Tabs.module.css.cjs');

const VALUE_ERROR = "Tabs.Tab or Tabs.Panel component was rendered with invalid value or without value";
const defaultProps = {
  keepMounted: true,
  orientation: "horizontal",
  loop: true,
  activateTabWithKeyboard: true,
  allowTabDeactivation: false,
  unstyled: false,
  inverted: false,
  variant: "default",
  placement: "left"
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { radius, color, autoContrast }) => ({
  root: {
    "--tabs-radius": getSize.getRadius(radius),
    "--tabs-color": getThemeColor.getThemeColor(color, theme),
    "--tabs-text-color": getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0
  }
}));
const Tabs = factory.factory((_props, ref) => {
  const props = useProps.useProps("Tabs", defaultProps, _props);
  const {
    defaultValue,
    value,
    onChange,
    orientation,
    children,
    loop,
    id,
    activateTabWithKeyboard,
    allowTabDeactivation,
    variant,
    color,
    radius,
    inverted,
    placement,
    keepMounted,
    classNames,
    styles,
    unstyled,
    className,
    style,
    vars,
    autoContrast,
    mod,
    ...others
  } = props;
  const uid = hooks.useId(id);
  const [currentTab, setCurrentTab] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: null,
    onChange
  });
  const getStyles = useStyles.useStyles({
    name: "Tabs",
    props,
    classes: Tabs_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Tabs_context.TabsProvider,
    {
      value: {
        placement,
        value: currentTab,
        orientation,
        id: uid,
        loop,
        activateTabWithKeyboard,
        getTabId: getSafeId.getSafeId(`${uid}-tab`, VALUE_ERROR),
        getPanelId: getSafeId.getSafeId(`${uid}-panel`, VALUE_ERROR),
        onChange: setCurrentTab,
        allowTabDeactivation,
        variant,
        color,
        radius,
        inverted,
        keepMounted,
        unstyled,
        getStyles
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Box.Box,
        {
          ref,
          id: uid,
          variant,
          mod: [
            {
              orientation,
              inverted: orientation === "horizontal" && inverted,
              placement: orientation === "vertical" && placement
            },
            mod
          ],
          ...getStyles("root"),
          ...others,
          children
        }
      )
    }
  );
});
Tabs.classes = Tabs_module;
Tabs.displayName = "@mantine/core/Tabs";
Tabs.Tab = TabsTab.TabsTab;
Tabs.Panel = TabsPanel.TabsPanel;
Tabs.List = TabsList.TabsList;

exports.Tabs = Tabs;
//# sourceMappingURL=Tabs.cjs.map
