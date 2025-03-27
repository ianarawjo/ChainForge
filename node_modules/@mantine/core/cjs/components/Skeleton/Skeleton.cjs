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
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Skeleton_module = require('./Skeleton.module.css.cjs');

const defaultProps = {
  visible: true,
  animate: true
};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { width, height, radius, circle }) => ({
    root: {
      "--skeleton-height": rem.rem(height),
      "--skeleton-width": circle ? rem.rem(height) : rem.rem(width),
      "--skeleton-radius": circle ? "1000px" : radius === void 0 ? void 0 : getSize.getRadius(radius)
    }
  })
);
const Skeleton = factory.factory((_props, ref) => {
  const props = useProps.useProps("Skeleton", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    width,
    height,
    circle,
    visible,
    radius,
    animate,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Skeleton",
    classes: Skeleton_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), mod: [{ visible, animate }, mod], ...others });
});
Skeleton.classes = Skeleton_module;
Skeleton.displayName = "@mantine/core/Skeleton";

exports.Skeleton = Skeleton;
//# sourceMappingURL=Skeleton.cjs.map
