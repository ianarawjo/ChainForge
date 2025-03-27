'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var rgba = require('../../core/MantineProvider/color-functions/rgba/rgba.cjs');
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
var Overlay_module = require('./Overlay.module.css.cjs');

const defaultProps = {
  zIndex: getDefaultZIndex.getDefaultZIndex("modal")
};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { gradient, color, backgroundOpacity, blur, radius, zIndex }) => ({
    root: {
      "--overlay-bg": gradient || (color !== void 0 || backgroundOpacity !== void 0) && rgba.rgba(color || "#000", backgroundOpacity ?? 0.6) || void 0,
      "--overlay-filter": blur ? `blur(${rem.rem(blur)})` : void 0,
      "--overlay-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
      "--overlay-z-index": zIndex?.toString()
    }
  })
);
const Overlay = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Overlay", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    fixed,
    center,
    children,
    radius,
    zIndex,
    gradient,
    blur,
    color,
    backgroundOpacity,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Overlay",
    props,
    classes: Overlay_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), mod: [{ center, fixed }, mod], ...others, children });
});
Overlay.classes = Overlay_module;
Overlay.displayName = "@mantine/core/Overlay";

exports.Overlay = Overlay;
//# sourceMappingURL=Overlay.cjs.map
