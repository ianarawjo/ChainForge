'use client';
import { jsx } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './Image.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { radius, fit }) => ({
  root: {
    "--image-radius": radius === void 0 ? void 0 : getRadius(radius),
    "--image-object-fit": fit
  }
}));
const Image = polymorphicFactory((_props, ref) => {
  const props = useProps("Image", defaultProps, _props);
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
  const [error, setError] = useState(!src);
  useEffect(() => setError(!src), [src]);
  const getStyles = useStyles({
    name: "Image",
    classes,
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
    return /* @__PURE__ */ jsx(
      Box,
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
  return /* @__PURE__ */ jsx(
    Box,
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
Image.classes = classes;
Image.displayName = "@mantine/core/Image";

export { Image };
//# sourceMappingURL=Image.mjs.map
