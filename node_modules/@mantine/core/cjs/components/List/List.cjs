'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
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
var List_context = require('./List.context.cjs');
var ListItem = require('./ListItem/ListItem.cjs');
var List_module = require('./List.module.css.cjs');

const defaultProps = {
  type: "unordered"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size, spacing }) => ({
  root: {
    "--list-fz": getSize.getFontSize(size),
    "--list-lh": getSize.getLineHeight(size),
    "--list-spacing": getSize.getSpacing(spacing)
  }
}));
const List = factory.factory((_props, ref) => {
  const props = useProps.useProps("List", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    type,
    withPadding,
    icon,
    spacing,
    center,
    listStyleType,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "List",
    classes: List_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(List_context.ListProvider, { value: { center, icon, getStyles }, children: /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getStyles("root", { style: { listStyleType } }),
      component: type === "unordered" ? "ul" : "ol",
      mod: [{ "with-padding": withPadding }, mod],
      ref,
      ...others,
      children
    }
  ) });
});
List.classes = List_module;
List.displayName = "@mantine/core/List";
List.Item = ListItem.ListItem;

exports.List = List;
//# sourceMappingURL=List.cjs.map
