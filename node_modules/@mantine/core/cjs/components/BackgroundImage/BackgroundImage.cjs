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
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var BackgroundImage_module = require('./BackgroundImage.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius }) => ({
  root: { "--bi-radius": radius === void 0 ? void 0 : getSize.getRadius(radius) }
}));
const BackgroundImage = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("BackgroundImage", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, radius, src, variant, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "BackgroundImage",
    props,
    classes: BackgroundImage_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      variant,
      ...getStyles("root", { style: { backgroundImage: `url(${src})` } }),
      ...others
    }
  );
});
BackgroundImage.classes = BackgroundImage_module;
BackgroundImage.displayName = "@mantine/core/BackgroundImage";

exports.BackgroundImage = BackgroundImage;
//# sourceMappingURL=BackgroundImage.cjs.map
