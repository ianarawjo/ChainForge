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
var Stack_module = require('./Stack.module.css.cjs');

const defaultProps = {
  gap: "md",
  align: "stretch",
  justify: "flex-start"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { gap, align, justify }) => ({
  root: {
    "--stack-gap": getSize.getSpacing(gap),
    "--stack-align": align,
    "--stack-justify": justify
  }
}));
const Stack = factory.factory((_props, ref) => {
  const props = useProps.useProps("Stack", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    align,
    justify,
    gap,
    variant,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Stack",
    props,
    classes: Stack_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), variant, ...others });
});
Stack.classes = Stack_module;
Stack.displayName = "@mantine/core/Stack";

exports.Stack = Stack;
//# sourceMappingURL=Stack.cjs.map
