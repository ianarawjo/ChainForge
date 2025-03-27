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
var ThemeIcon_module = require('./ThemeIcon.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { size, radius, variant, gradient, color, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      gradient,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--ti-size": getSize.getSize(size, "ti-size"),
        "--ti-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--ti-bg": color || variant ? colors.background : void 0,
        "--ti-color": color || variant ? colors.color : void 0,
        "--ti-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const ThemeIcon = factory.factory((_props, ref) => {
  const props = useProps.useProps("ThemeIcon", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, autoContrast, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "ThemeIcon",
    classes: ThemeIcon_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others });
});
ThemeIcon.classes = ThemeIcon_module;
ThemeIcon.displayName = "@mantine/core/ThemeIcon";

exports.ThemeIcon = ThemeIcon;
//# sourceMappingURL=ThemeIcon.cjs.map
