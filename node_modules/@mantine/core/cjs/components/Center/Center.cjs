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
var Box = require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Center_module = require('./Center.module.css.cjs');

const defaultProps = {};
const Center = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Center", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, inline, mod, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "Center",
    props,
    classes: Center_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, mod: [{ inline }, mod], ...getStyles("root"), ...others });
});
Center.classes = Center_module;
Center.displayName = "@mantine/core/Center";

exports.Center = Center;
//# sourceMappingURL=Center.cjs.map
