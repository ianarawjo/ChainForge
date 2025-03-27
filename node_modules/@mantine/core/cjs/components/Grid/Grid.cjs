'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
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
var useRandomClassname = require('../../core/Box/use-random-classname/use-random-classname.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Grid_context = require('./Grid.context.cjs');
var GridCol = require('./GridCol/GridCol.cjs');
var GridVariables = require('./GridVariables.cjs');
var Grid_module = require('./Grid.module.css.cjs');

const defaultProps = {
  gutter: "md",
  grow: false,
  columns: 12
};
const varsResolver = createVarsResolver.createVarsResolver((_, { justify, align, overflow }) => ({
  root: {
    "--grid-justify": justify,
    "--grid-align": align,
    "--grid-overflow": overflow
  }
}));
const Grid = factory.factory((_props, ref) => {
  const props = useProps.useProps("Grid", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    grow,
    gutter,
    columns,
    align,
    justify,
    children,
    breakpoints,
    type,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Grid",
    classes: Grid_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const responsiveClassName = useRandomClassname.useRandomClassName();
  if (type === "container" && breakpoints) {
    return /* @__PURE__ */ jsxRuntime.jsxs(Grid_context.GridProvider, { value: { getStyles, grow, columns: columns || 12, breakpoints, type }, children: [
      /* @__PURE__ */ jsxRuntime.jsx(GridVariables.GridVariables, { selector: `.${responsiveClassName}`, ...props }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("container"), children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others, children: /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("inner"), children }) }) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(Grid_context.GridProvider, { value: { getStyles, grow, columns: columns || 12, breakpoints, type }, children: [
    /* @__PURE__ */ jsxRuntime.jsx(GridVariables.GridVariables, { selector: `.${responsiveClassName}`, ...props }),
    /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others, children: /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("inner"), children }) })
  ] });
});
Grid.classes = Grid_module;
Grid.displayName = "@mantine/core/Grid";
Grid.Col = GridCol.GridCol;

exports.Grid = Grid;
//# sourceMappingURL=Grid.cjs.map
