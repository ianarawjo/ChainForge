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
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var getMarkColor = require('./get-mark-color.cjs');
var Mark_module = require('./Mark.module.css.cjs');

const defaultProps = {
  color: "yellow"
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { color }) => ({
  root: {
    "--mark-bg-dark": getMarkColor.getMarkColor({ color, theme, defaultShade: 5 }),
    "--mark-bg-light": getMarkColor.getMarkColor({ color, theme, defaultShade: 2 })
  }
}));
const Mark = factory.factory((_props, ref) => {
  const props = useProps.useProps("Mark", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, color, variant, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "Mark",
    props,
    className,
    style,
    classes: Mark_module,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "mark", ref, variant, ...getStyles("root"), ...others });
});
Mark.classes = Mark_module;
Mark.displayName = "@mantine/core/Mark";

exports.Mark = Mark;
//# sourceMappingURL=Mark.cjs.map
