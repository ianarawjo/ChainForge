'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useRef, useEffect } from 'react';
import { useId } from '@mantine/hooks';
import { getSize, getRadius } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { parseThemeColor } from '../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.mjs';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { getContrastColor } from '../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.mjs';
import { getAutoContrastValue } from '../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { extractStyleProps } from '../../core/Box/style-props/extract-style-props/extract-style-props.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { InlineInputClasses, InlineInput } from '../InlineInput/InlineInput.mjs';
import { CheckboxCard } from './CheckboxCard/CheckboxCard.mjs';
import { useCheckboxGroupContext } from './CheckboxGroup.context.mjs';
import { CheckboxGroup } from './CheckboxGroup/CheckboxGroup.mjs';
import { CheckboxIndicator } from './CheckboxIndicator/CheckboxIndicator.mjs';
import { CheckboxIcon } from './CheckIcon.mjs';
import classes from './Checkbox.module.css.mjs';

const defaultProps = {
  labelPosition: "right",
  icon: CheckboxIcon
};
const varsResolver = createVarsResolver(
  (theme, { radius, color, size, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      root: {
        "--checkbox-size": getSize(size, "checkbox-size"),
        "--checkbox-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--checkbox-color": variant === "outline" ? outlineColor : getThemeColor(color, theme),
        "--checkbox-icon-color": iconColor ? getThemeColor(iconColor, theme) : getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0
      }
    };
  }
);
const Checkbox = factory((_props, forwardedRef) => {
  const props = useProps("Checkbox", defaultProps, _props);
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
  const ctx = useCheckboxGroupContext();
  const _size = size || ctx?.size;
  const Icon = icon;
  const getStyles = useStyles({
    name: "Checkbox",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { styleProps, rest } = extractStyleProps(others);
  const uuid = useId(id);
  const contextProps = ctx ? {
    checked: ctx.value.includes(rest.value),
    onChange: (event) => {
      ctx.onChange(event);
      onChange?.(event);
    }
  } : {};
  const fallbackRef = useRef(null);
  const ref = forwardedRef || fallbackRef;
  useEffect(() => {
    if (ref && "current" in ref && ref.current) {
      ref.current.indeterminate = indeterminate || false;
    }
  }, [indeterminate, ref]);
  return /* @__PURE__ */ jsx(
    InlineInput,
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
      children: /* @__PURE__ */ jsxs(Box, { ...getStyles("inner"), mod: { "data-label-position": labelPosition }, children: [
        /* @__PURE__ */ jsx(
          Box,
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
        /* @__PURE__ */ jsx(Icon, { indeterminate, ...getStyles("icon") })
      ] })
    }
  );
});
Checkbox.classes = { ...classes, ...InlineInputClasses };
Checkbox.displayName = "@mantine/core/Checkbox";
Checkbox.Group = CheckboxGroup;
Checkbox.Indicator = CheckboxIndicator;
Checkbox.Card = CheckboxCard;

export { Checkbox };
//# sourceMappingURL=Checkbox.mjs.map
