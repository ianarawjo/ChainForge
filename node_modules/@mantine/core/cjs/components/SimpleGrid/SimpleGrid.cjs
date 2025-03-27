'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
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
var SimpleGridVariables = require('./SimpleGridVariables.cjs');
var SimpleGrid_module = require('./SimpleGrid.module.css.cjs');

const defaultProps = {
  cols: 1,
  spacing: "md",
  type: "media"
};
const SimpleGrid = factory.factory((_props, ref) => {
  const props = useProps.useProps("SimpleGrid", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    cols,
    verticalSpacing,
    spacing,
    type,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "SimpleGrid",
    classes: SimpleGrid_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars
  });
  const responsiveClassName = useRandomClassname.useRandomClassName();
  if (type === "container") {
    return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(SimpleGridVariables.SimpleGridContainerVariables, { ...props, selector: `.${responsiveClassName}` }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("container"), children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others }) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(SimpleGridVariables.SimpleGridMediaVariables, { ...props, selector: `.${responsiveClassName}` }),
    /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others })
  ] });
});
SimpleGrid.classes = SimpleGrid_module;
SimpleGrid.displayName = "@mantine/core/SimpleGrid";

exports.SimpleGrid = SimpleGrid;
//# sourceMappingURL=SimpleGrid.cjs.map
