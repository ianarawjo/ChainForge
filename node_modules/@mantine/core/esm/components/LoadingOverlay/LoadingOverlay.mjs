'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import 'react';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Loader } from '../Loader/Loader.mjs';
import { Overlay } from '../Overlay/Overlay.mjs';
import { Transition } from '../Transition/Transition.mjs';
import classes from './LoadingOverlay.module.css.mjs';

const defaultProps = {
  transitionProps: { transition: "fade", duration: 0 },
  overlayProps: { backgroundOpacity: 0.75 },
  zIndex: getDefaultZIndex("overlay")
};
const varsResolver = createVarsResolver((_, { zIndex }) => ({
  root: {
    "--lo-z-index": zIndex?.toString()
  }
}));
const LoadingOverlay = factory((_props, ref) => {
  const props = useProps("LoadingOverlay", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    transitionProps,
    loaderProps,
    overlayProps,
    visible,
    zIndex,
    ...others
  } = props;
  const theme = useMantineTheme();
  const getStyles = useStyles({
    name: "LoadingOverlay",
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
  const _overlayProps = { ...defaultProps.overlayProps, ...overlayProps };
  return /* @__PURE__ */ jsx(Transition, { transition: "fade", ...transitionProps, mounted: !!visible, children: (transitionStyles) => /* @__PURE__ */ jsxs(Box, { ...getStyles("root", { style: transitionStyles }), ref, ...others, children: [
    /* @__PURE__ */ jsx(Loader, { ...getStyles("loader"), unstyled, ...loaderProps }),
    /* @__PURE__ */ jsx(
      Overlay,
      {
        ..._overlayProps,
        ...getStyles("overlay"),
        darkHidden: true,
        unstyled,
        color: overlayProps?.color || theme.white
      }
    ),
    /* @__PURE__ */ jsx(
      Overlay,
      {
        ..._overlayProps,
        ...getStyles("overlay"),
        lightHidden: true,
        unstyled,
        color: overlayProps?.color || theme.colors.dark[5]
      }
    )
  ] }) });
});
LoadingOverlay.classes = classes;
LoadingOverlay.displayName = "@mantine/core/LoadingOverlay";

export { LoadingOverlay };
//# sourceMappingURL=LoadingOverlay.mjs.map
