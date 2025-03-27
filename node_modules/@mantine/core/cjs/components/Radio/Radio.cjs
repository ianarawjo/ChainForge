'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var parseThemeColor = require('../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.cjs');
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
var extractStyleProps = require('../../core/Box/style-props/extract-style-props/extract-style-props.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var InlineInput = require('../InlineInput/InlineInput.cjs');
var RadioCard = require('./RadioCard/RadioCard.cjs');
var RadioGroup_context = require('./RadioGroup.context.cjs');
var RadioGroup = require('./RadioGroup/RadioGroup.cjs');
var RadioIcon = require('./RadioIcon.cjs');
var RadioIndicator = require('./RadioIndicator/RadioIndicator.cjs');
var Radio_module = require('./Radio.module.css.cjs');

const defaultProps = {
  labelPosition: "right"
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { size, radius, color, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor.parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      root: {
        "--radio-size": getSize.getSize(size, "radio-size"),
        "--radio-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--radio-color": variant === "outline" ? outlineColor : getThemeColor.getThemeColor(color, theme),
        "--radio-icon-color": iconColor ? getThemeColor.getThemeColor(iconColor, theme) : getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0,
        "--radio-icon-size": getSize.getSize(size, "radio-icon-size")
      }
    };
  }
);
const Radio = factory.factory((_props, ref) => {
  const props = useProps.useProps("Radio", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    id,
    size,
    label,
    labelPosition,
    description,
    error,
    radius,
    color,
    variant,
    disabled,
    wrapperProps,
    icon: Icon = RadioIcon.RadioIcon,
    rootRef,
    iconColor,
    onChange,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Radio",
    classes: Radio_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const ctx = RadioGroup_context.useRadioGroupContext();
  const contextSize = ctx?.size ?? size;
  const componentSize = props.size ? size : contextSize;
  const { styleProps, rest } = extractStyleProps.extractStyleProps(others);
  const uuid = hooks.useId(id);
  const contextProps = ctx ? {
    checked: ctx.value === rest.value,
    name: rest.name ?? ctx.name,
    onChange: (event) => {
      ctx.onChange(event);
      onChange?.(event);
    }
  } : {};
  return /* @__PURE__ */ jsxRuntime.jsx(
    InlineInput.InlineInput,
    {
      ...getStyles("root"),
      __staticSelector: "Radio",
      __stylesApiProps: props,
      id: uuid,
      size: componentSize,
      labelPosition,
      label,
      description,
      error,
      disabled,
      classNames,
      styles,
      unstyled,
      "data-checked": contextProps.checked || void 0,
      variant,
      ref: rootRef,
      mod,
      ...styleProps,
      ...wrapperProps,
      children: /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ...getStyles("inner"), mod: { "label-position": labelPosition }, children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            ...getStyles("radio", { focusable: true, variant }),
            onChange,
            ...rest,
            ...contextProps,
            component: "input",
            mod: { error: !!error },
            ref,
            id: uuid,
            disabled,
            type: "radio"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(Icon, { ...getStyles("icon"), "aria-hidden": true })
      ] })
    }
  );
});
Radio.classes = Radio_module;
Radio.displayName = "@mantine/core/Radio";
Radio.Group = RadioGroup.RadioGroup;
Radio.Card = RadioCard.RadioCard;
Radio.Indicator = RadioIndicator.RadioIndicator;

exports.Radio = Radio;
//# sourceMappingURL=Radio.cjs.map
