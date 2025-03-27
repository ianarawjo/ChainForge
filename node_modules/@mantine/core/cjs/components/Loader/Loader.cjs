'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
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
var Bars = require('./loaders/Bars.cjs');
var Dots = require('./loaders/Dots.cjs');
var Oval = require('./loaders/Oval.cjs');
var Loader_module = require('./Loader.module.css.cjs');

const defaultLoaders = {
  bars: Bars.Bars,
  oval: Oval.Oval,
  dots: Dots.Dots
};
const defaultProps = {
  loaders: defaultLoaders,
  type: "oval"
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { size, color }) => ({
  root: {
    "--loader-size": getSize.getSize(size, "loader-size"),
    "--loader-color": color ? getThemeColor.getThemeColor(color, theme) : void 0
  }
}));
const Loader = factory.factory((_props, ref) => {
  const props = useProps.useProps("Loader", defaultProps, _props);
  const {
    size,
    color,
    type,
    vars,
    className,
    style,
    classNames,
    styles,
    unstyled,
    loaders,
    variant,
    children,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Loader",
    props,
    classes: Loader_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  if (children) {
    return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...getStyles("root"), ref, ...others, children });
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getStyles("root"),
      ref,
      component: loaders[type],
      variant,
      size,
      ...others
    }
  );
});
Loader.defaultLoaders = defaultLoaders;
Loader.classes = Loader_module;
Loader.displayName = "@mantine/core/Loader";

exports.Loader = Loader;
exports.defaultLoaders = defaultLoaders;
//# sourceMappingURL=Loader.cjs.map
