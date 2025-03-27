'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
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
var CheckboxCard = require('./CheckboxCard/CheckboxCard.cjs');
var CheckboxGroup_context = require('./CheckboxGroup.context.cjs');
var CheckboxGroup = require('./CheckboxGroup/CheckboxGroup.cjs');
var CheckboxIndicator = require('./CheckboxIndicator/CheckboxIndicator.cjs');
var CheckIcon = require('./CheckIcon.cjs');
var Checkbox_module = require('./Checkbox.module.css.cjs');

const defaultProps = {
  labelPosition: "right",
  icon: CheckIcon.CheckboxIcon
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { radius, color, size, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor.parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      root: {
        "--checkbox-size": getSize.getSize(size, "checkbox-size"),
        "--checkbox-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--checkbox-color": variant === "outline" ? outlineColor : getThemeColor.getThemeColor(color, theme),
        "--checkbox-icon-color": iconColor ? getThemeColor.getThemeColor(iconColor, theme) : getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0
      }
    };
  }
);
const Checkbox = factory.factory((_props, forwardedRef) => {
  const props = useProps.useProps("Checkbox", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    label,
    id,
    size,
    radius,
    wrapperProps,
    checked,
    labelPosition,
    description,
    error,
    disabled,
    variant,
    indeterminate,
    icon,
    rootRef,
    iconColor,
    onChange,
    autoContrast,
    mod,
    ...others
  } = props;
  const ctx = CheckboxGroup_context.useCheckboxGroupContext();
  const _size = size || ctx?.size;
  const Icon = icon;
  const getStyles = useStyles.useStyles({
    name: "Checkbox",
    props,
    classes: Checkbox_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { styleProps, rest } = extractStyleProps.extractStyleProps(others);
  const uuid = hooks.useId(id);
  const contextProps = ctx ? {
    checked: ctx.value.includes(rest.value),
    onChange: (event) => {
      ctx.onChange(event);
      onChange?.(event);
    }
  } : {};
  const fallbackRef = React.useRef(null);
  const ref = forwardedRef || fallbackRef;
  React.useEffect(() => {
    if (ref && "current" in ref && ref.current) {
      ref.current.indeterminate = indeterminate || false;
    }
  }, [indeterminate, ref]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    InlineInput.InlineInput,
    {
      ...getStyles("root"),
      __staticSelector: "Checkbox",
      __stylesApiProps: props,
      id: uuid,
      size: _size,
      labelPosition,
      label,
      description,
      error,
      disabled,
      classNames,
      styles,
      unstyled,
      "data-checked": contextProps.checked || checked || void 0,
      variant,
      ref: rootRef,
      mod,
      ...styleProps,
      ...wrapperProps,
      children: /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ...getStyles("inner"), mod: { "data-label-position": labelPosition }, children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            component: "input",
            id: uuid,
            ref,
            checked,
            disabled,
            mod: { error: !!error, indeterminate },
            ...getStyles("input", { focusable: true, variant }),
            onChange,
            ...rest,
            ...contextProps,
            type: "checkbox"
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(Icon, { indeterminate, ...getStyles("icon") })
      ] })
    }
  );
});
Checkbox.classes = { ...Checkbox_module, ...InlineInput.InlineInputClasses };
Checkbox.displayName = "@mantine/core/Checkbox";
Checkbox.Group = CheckboxGroup.CheckboxGroup;
Checkbox.Indicator = CheckboxIndicator.CheckboxIndicator;
Checkbox.Card = CheckboxCard.CheckboxCard;

exports.Checkbox = Checkbox;
//# sourceMappingURL=Checkbox.cjs.map
