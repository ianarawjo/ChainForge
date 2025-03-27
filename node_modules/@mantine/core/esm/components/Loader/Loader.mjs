'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Bars } from './loaders/Bars.mjs';
import { Dots } from './loaders/Dots.mjs';
import { Oval } from './loaders/Oval.mjs';
import classes from './Loader.module.css.mjs';

const defaultLoaders = {
  bars: Bars,
  oval: Oval,
  dots: Dots
};
const defaultProps = {
  loaders: defaultLoaders,
  type: "oval"
};
const varsResolver = createVarsResolver((theme, { size, color }) => ({
  root: {
    "--loader-size": getSize(size, "loader-size"),
    "--loader-color": color ? getThemeColor(color, theme) : void 0
  }
}));
const Loader = factory((_props, ref) => {
  const props = useProps("Loader", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Loader",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  if (children) {
    return /* @__PURE__ */ jsx(Box, { ...getStyles("root"), ref, ...others, children });
  }
  return /* @__PURE__ */ jsx(
    Box,
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
Loader.classes = classes;
Loader.displayName = "@mantine/core/Loader";

export { Loader, defaultLoaders };
//# sourceMappingURL=Loader.mjs.map
