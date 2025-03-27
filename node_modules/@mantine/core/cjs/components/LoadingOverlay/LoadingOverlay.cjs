'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Loader = require('../Loader/Loader.cjs');
var Overlay = require('../Overlay/Overlay.cjs');
var Transition = require('../Transition/Transition.cjs');
var LoadingOverlay_module = require('./LoadingOverlay.module.css.cjs');

const defaultProps = {
  transitionProps: { transition: "fade", duration: 0 },
  overlayProps: { backgroundOpacity: 0.75 },
  zIndex: getDefaultZIndex.getDefaultZIndex("overlay")
};
const varsResolver = createVarsResolver.createVarsResolver((_, { zIndex }) => ({
  root: {
    "--lo-z-index": zIndex?.toString()
  }
}));
const LoadingOverlay = factory.factory((_props, ref) => {
  const props = useProps.useProps("LoadingOverlay", defaultProps, _props);
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
  const theme = MantineThemeProvider.useMantineTheme();
  const getStyles = useStyles.useStyles({
    name: "LoadingOverlay",
    classes: LoadingOverlay_module,
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
  return /* @__PURE__ */ jsxRuntime.jsx(Transition.Transition, { transition: "fade", ...transitionProps, mounted: !!visible, children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ...getStyles("root", { style: transitionStyles }), ref, ...others, children: [
    /* @__PURE__ */ jsxRuntime.jsx(Loader.Loader, { ...getStyles("loader"), unstyled, ...loaderProps }),
    /* @__PURE__ */ jsxRuntime.jsx(
      Overlay.Overlay,
      {
        ..._overlayProps,
        ...getStyles("overlay"),
        darkHidden: true,
        unstyled,
        color: overlayProps?.color || theme.white
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      Overlay.Overlay,
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
LoadingOverlay.classes = LoadingOverlay_module;
LoadingOverlay.displayName = "@mantine/core/LoadingOverlay";

exports.LoadingOverlay = LoadingOverlay;
//# sourceMappingURL=LoadingOverlay.cjs.map
