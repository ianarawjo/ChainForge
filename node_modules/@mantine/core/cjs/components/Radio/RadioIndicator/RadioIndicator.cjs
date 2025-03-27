'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var parseThemeColor = require('../../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.cjs');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var getContrastColor = require('../../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
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
var RadioCard_context = require('../RadioCard/RadioCard.context.cjs');
var RadioIcon = require('../RadioIcon.cjs');
var RadioIndicator_module = require('./RadioIndicator.module.css.cjs');

const defaultProps = {
  icon: RadioIcon.RadioIcon
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { radius, color, size, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor.parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      indicator: {
        "--radio-size": getSize.getSize(size, "radio-size"),
        "--radio-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--radio-color": variant === "outline" ? outlineColor : getThemeColor.getThemeColor(color, theme),
        "--radio-icon-size": getSize.getSize(size, "radio-icon-size"),
        "--radio-icon-color": iconColor ? getThemeColor.getThemeColor(iconColor, theme) : getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0
      }
    };
  }
);
const RadioIndicator = factory.factory((_props, ref) => {
  const props = useProps.useProps("RadioIndicator", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    icon,
    radius,
    color,
    iconColor,
    autoContrast,
    checked,
    mod,
    variant,
    disabled,
    ...others
  } = props;
  const Icon = icon;
  const getStyles = useStyles.useStyles({
    name: "RadioIndicator",
    classes: RadioIndicator_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "indicator"
  });
  const ctx = RadioCard_context.useRadioCardContext();
  const _checked = typeof checked === "boolean" ? checked : ctx?.checked || false;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      ...getStyles("indicator", { variant }),
      variant,
      mod: [{ checked: _checked, disabled }, mod],
      ...others,
      children: /* @__PURE__ */ jsxRuntime.jsx(Icon, { ...getStyles("icon") })
    }
  );
});
RadioIndicator.displayName = "@mantine/core/RadioIndicator";
RadioIndicator.classes = RadioIndicator_module;

exports.RadioIndicator = RadioIndicator;
//# sourceMappingURL=RadioIndicator.cjs.map
