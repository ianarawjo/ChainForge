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
const TabsList = factory.factory((_props, ref) => {
  const props = useProps.useProps("TabsList", defaultProps, _props);
  const { children, className, grow, justify, classNames, styles, style, mod, ...others } = props;
  const ctx = Tabs_context.useTabsContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...others,
      ...ctx.getStyles("list", {
        className,
        style,
        classNames,
        styles,
        props,
        variant: ctx.variant
      }),
      ref,
      role: "tablist",
      variant: ctx.variant,
      mod: [
        {
          grow,
          orientation: ctx.orientation,
          placement: ctx.orientation === "vertical" && ctx.placement,
          inverted: ctx.inverted
        },
        mod
      ],
      "aria-orientation": ctx.orientation,
      __vars: { "--tabs-justify": justify },
      children
    }
  );
});
TabsList.classes = Tabs_module;
TabsList.displayName = "@mantine/core/TabsList";

exports.TabsList = TabsList;
//# sourceMappingURL=TabsList.cjs.map
