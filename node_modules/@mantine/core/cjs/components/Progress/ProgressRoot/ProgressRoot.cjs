'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Progress_context = require('../Progress.context.cjs');
var Progress_module = require('../Progress.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { size, radius, transitionDuration }) => ({
    root: {
      "--progress-size": getSize.getSize(size, "progress-size"),
      "--progress-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
      "--progress-transition-duration": typeof transitionDuration === "number" ? `${transitionDuration}ms` : void 0
    }
  })
);
const ProgressRoot = factory.factory((_props, ref) => {
  const props = useProps.useProps("ProgressRoot", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    autoContrast,
    transitionDuration,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Progress",
    classes: Progress_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Progress_context.ProgressProvider, { value: { getStyles, autoContrast }, children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others }) });
});
ProgressRoot.classes = Progress_module;
ProgressRoot.displayName = "@mantine/core/ProgressRoot";

exports.ProgressRoot = ProgressRoot;
//# sourceMappingURL=ProgressRoot.cjs.map
