'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
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
var UnstyledButton = require('../UnstyledButton/UnstyledButton.cjs');
var Burger_module = require('./Burger.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { color, size, lineSize, transitionDuration, transitionTimingFunction }) => ({
    root: {
      "--burger-color": color ? getThemeColor.getThemeColor(color, theme) : void 0,
      "--burger-size": getSize.getSize(size, "burger-size"),
      "--burger-line-size": lineSize ? rem.rem(lineSize) : void 0,
      "--burger-transition-duration": transitionDuration === void 0 ? void 0 : `${transitionDuration}ms`,
      "--burger-transition-timing-function": transitionTimingFunction
    }
  })
);
const Burger = factory.factory((_props, ref) => {
  const props = useProps.useProps("Burger", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    opened,
    children,
    transitionDuration,
    transitionTimingFunction,
    lineSize,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Burger",
    classes: Burger_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(UnstyledButton.UnstyledButton, { ...getStyles("root"), ref, ...others, children: [
    /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { mod: ["reduce-motion", { opened }], ...getStyles("burger") }),
    children
  ] });
});
Burger.classes = Burger_module;
Burger.displayName = "@mantine/core/Burger";

exports.Burger = Burger;
//# sourceMappingURL=Burger.cjs.map
