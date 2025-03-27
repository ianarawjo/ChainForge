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
var AspectRatio_module = require('./AspectRatio.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { ratio }) => ({
  root: {
    "--ar-ratio": ratio?.toString()
  }
}));
const AspectRatio = factory.factory((_props, ref) => {
  const props = useProps.useProps("AspectRatio", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, ratio, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "AspectRatio",
    classes: AspectRatio_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others });
});
AspectRatio.classes = AspectRatio_module;
AspectRatio.displayName = "@mantine/core/AspectRatio";

exports.AspectRatio = AspectRatio;
//# sourceMappingURL=AspectRatio.cjs.map
