'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
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
var Image_module = require('./Image.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius, fit }) => ({
  root: {
    "--image-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
    "--image-object-fit": fit
  }
}));
const Image = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Image", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    onError,
    src,
    radius,
    fit,
    fallbackSrc,
    mod,
    ...others
  } = props;
  const [error, setError] = React.useState(!src);
  React.useEffect(() => setError(!src), [src]);
  const getStyles = useStyles.useStyles({
    name: "Image",
    classes: Image_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  if (error && fallbackSrc) {
    return /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        component: "img",
        ref,
        src: fallbackSrc,
        ...getStyles("root"),
        onError,
        mod: ["fallback", mod],
        ...others
      }
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "img",
      ref,
      ...getStyles("root"),
      src,
      onError: (event) => {
        onError?.(event);
        setError(true);
      },
      mod,
      ...others
    }
  );
});
Image.classes = Image_module;
Image.displayName = "@mantine/core/Image";

exports.Image = Image;
//# sourceMappingURL=Image.cjs.map
