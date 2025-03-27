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
var getContrastColor = require('../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
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
var getPositionVariables = require('./get-position-variables/get-position-variables.cjs');
var Indicator_module = require('./Indicator.module.css.cjs');

const defaultProps = {
  position: "top-end",
  offset: 0,
  inline: false,
  withBorder: false,
  disabled: false,
  processing: false
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { color, position, offset, size, radius, zIndex, autoContrast }) => ({
    root: {
      "--indicator-color": color ? getThemeColor.getThemeColor(color, theme) : void 0,
      "--indicator-text-color": getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0,
      "--indicator-size": rem.rem(size),
      "--indicator-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
      "--indicator-z-index": zIndex?.toString(),
      ...getPositionVariables.getPositionVariables(position, offset)
    }
  })
);
const Indicator = factory.factory((_props, ref) => {
  const props = useProps.useProps("Indicator", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    position,
    offset,
    inline,
    label,
    radius,
    color,
    withBorder,
    disabled,
    processing,
    zIndex,
    autoContrast,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Indicator",
    classes: Indicator_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ref, ...getStyles("root"), mod: [{ inline }, mod], ...others, children: [
    !disabled && /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        mod: { "with-label": !!label, "with-border": withBorder, processing },
        ...getStyles("indicator"),
        children: label
      }
    ),
    children
  ] });
});
Indicator.classes = Indicator_module;
Indicator.displayName = "@mantine/core/Indicator";

exports.Indicator = Indicator;
//# sourceMappingURL=Indicator.cjs.map
