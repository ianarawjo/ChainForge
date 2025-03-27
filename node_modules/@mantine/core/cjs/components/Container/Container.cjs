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
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Container_module = require('./Container.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { size, fluid }) => ({
  root: {
    "--container-size": fluid ? void 0 : getSize.getSize(size, "container-size")
  }
}));
const Container = factory.factory((_props, ref) => {
  const props = useProps.useProps("Container", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, fluid, mod, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "Container",
    classes: Container_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, mod: [{ fluid }, mod], ...getStyles("root"), ...others });
});
Container.classes = Container_module;
Container.displayName = "@mantine/core/Container";

exports.Container = Container;
//# sourceMappingURL=Container.cjs.map
