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
var Kbd_module = require('./Kbd.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  root: {
    "--kbd-fz": getSize.getSize(size, "kbd-fz"),
    "--kbd-padding": getSize.getSize(size, "kbd-padding")
  }
}));
const Kbd = factory.factory((_props, ref) => {
  const props = useProps.useProps("Kbd", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "Kbd",
    classes: Kbd_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "kbd", ref, ...getStyles("root"), ...others });
});
Kbd.classes = Kbd_module;
Kbd.displayName = "@mantine/core/Kbd";

exports.Kbd = Kbd;
//# sourceMappingURL=Kbd.cjs.map
