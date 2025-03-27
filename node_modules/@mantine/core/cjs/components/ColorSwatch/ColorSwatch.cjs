'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
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
var ColorSwatch_module = require('./ColorSwatch.module.css.cjs');

const defaultProps = {
  withShadow: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius, size }) => ({
  root: {
    "--cs-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
    "--cs-size": rem.rem(size)
  }
}));
const ColorSwatch = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("ColorSwatch", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    size,
    radius,
    withShadow,
    children,
    variant,
    ...others
  } = useProps.useProps("ColorSwatch", defaultProps, props);
  const getStyles = useStyles.useStyles({
    name: "ColorSwatch",
    props,
    classes: ColorSwatch_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ref,
      variant,
      size,
      ...getStyles("root", { focusable: true }),
      ...others,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("alphaOverlay") }),
        withShadow && /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("shadowOverlay") }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("colorOverlay", { style: { backgroundColor: color } }) }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("childrenOverlay"), children })
      ]
    }
  );
});
ColorSwatch.classes = ColorSwatch_module;
ColorSwatch.displayName = "@mantine/core/ColorSwatch";

exports.ColorSwatch = ColorSwatch;
//# sourceMappingURL=ColorSwatch.cjs.map
