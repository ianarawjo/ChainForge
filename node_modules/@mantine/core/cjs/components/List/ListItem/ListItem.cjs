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
var List_context = require('../List.context.cjs');
var List_module = require('../List.module.css.cjs');

const defaultProps = {};
const ListItem = factory.factory((_props, ref) => {
  const props = useProps.useProps("ListItem", defaultProps, _props);
  const { classNames, className, style, styles, vars, icon, children, mod, ...others } = props;
  const ctx = List_context.useListContext();
  const _icon = icon || ctx.icon;
  const stylesApiProps = { classNames, styles };
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...ctx.getStyles("item", { ...stylesApiProps, className, style }),
      component: "li",
      mod: [{ "with-icon": !!_icon, centered: ctx.center }, mod],
      ref,
      ...others,
      children: /* @__PURE__ */ jsxRuntime.jsxs("div", { ...ctx.getStyles("itemWrapper", stylesApiProps), children: [
        _icon && /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("itemIcon", stylesApiProps), children: _icon }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("itemLabel", stylesApiProps), children })
      ] })
    }
  );
});
ListItem.classes = List_module;
ListItem.displayName = "@mantine/core/ListItem";

exports.ListItem = ListItem;
//# sourceMappingURL=ListItem.cjs.map
