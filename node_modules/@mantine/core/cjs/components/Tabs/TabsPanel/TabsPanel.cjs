'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Tabs_context = require('../Tabs.context.cjs');
var Tabs_module = require('../Tabs.module.css.cjs');

const defaultProps = {};
const TabsPanel = factory.factory((_props, ref) => {
  const props = useProps.useProps("TabsPanel", defaultProps, _props);
  const { children, className, value, classNames, styles, style, mod, keepMounted, ...others } = props;
  const ctx = Tabs_context.useTabsContext();
  const active = ctx.value === value;
  const content = ctx.keepMounted || keepMounted ? children : active ? children : null;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...others,
      ...ctx.getStyles("panel", {
        className,
        classNames,
        styles,
        style: [style, !active ? { display: "none" } : void 0],
        props
      }),
      ref,
      mod: [{ orientation: ctx.orientation }, mod],
      role: "tabpanel",
      id: ctx.getPanelId(value),
      "aria-labelledby": ctx.getTabId(value),
      children: content
    }
  );
});
TabsPanel.classes = Tabs_module;
TabsPanel.displayName = "@mantine/core/TabsPanel";

exports.TabsPanel = TabsPanel;
//# sourceMappingURL=TabsPanel.cjs.map
