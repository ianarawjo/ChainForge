'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
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
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Badge_module = require('./Badge.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { radius, color, gradient, variant, size, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      gradient,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--badge-height": getSize.getSize(size, "badge-height"),
        "--badge-padding-x": getSize.getSize(size, "badge-padding-x"),
        "--badge-fz": getSize.getSize(size, "badge-fz"),
        "--badge-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--badge-bg": color || variant ? colors.background : void 0,
        "--badge-color": color || variant ? colors.color : void 0,
        "--badge-bd": color || variant ? colors.border : void 0,
        "--badge-dot-color": variant === "dot" ? getThemeColor.getThemeColor(color, theme) : void 0
      }
    };
  }
);
const Badge = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Badge", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    radius,
    color,
    gradient,
    leftSection,
    rightSection,
    children,
    variant,
    fullWidth,
    autoContrast,
    circle,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Badge",
    props,
    classes: Badge_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      variant,
      mod: [
        {
          block: fullWidth,
          circle,
          "with-right-section": !!rightSection,
          "with-left-section": !!leftSection
        },
        mod
      ],
      ...getStyles("root", { variant }),
      ref,
      ...others,
      children: [
        leftSection && /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("section"), "data-position": "left", children: leftSection }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("label"), children }),
        rightSection && /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("section"), "data-position": "right", children: rightSection })
      ]
    }
  );
});
Badge.classes = Badge_module;
Badge.displayName = "@mantine/core/Badge";

exports.Badge = Badge;
//# sourceMappingURL=Badge.cjs.map
