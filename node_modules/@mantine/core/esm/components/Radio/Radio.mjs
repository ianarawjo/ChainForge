'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useId } from '@mantine/hooks';
import 'react';
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
import { InlineInput } from '../InlineInput/InlineInput.mjs';
import { RadioCard } from './RadioCard/RadioCard.mjs';
import { useRadioGroupContext } from './RadioGroup.context.mjs';
import { RadioGroup } from './RadioGroup/RadioGroup.mjs';
import { RadioIcon } from './RadioIcon.mjs';
import { RadioIndicator } from './RadioIndicator/RadioIndicator.mjs';
import classes from './Radio.module.css.mjs';

const defaultProps = {
  labelPosition: "right"
};
const varsResolver = createVarsResolver(
  (theme, { size, radius, color, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      root: {
        "--radio-size": getSize(size, "radio-size"),
        "--radio-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--radio-color": variant === "outline" ? outlineColor : getThemeColor(color, theme),
        "--radio-icon-color": iconColor ? getThemeColor(iconColor, theme) : getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0,
        "--radio-icon-size": getSize(size, "radio-icon-size")
      }
    };
  }
);
const Radio = factory((_props, ref) => {
  const props = useProps("Radio", defaultProps, _props);
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
    icon: Icon = RadioIcon,
    rootRef,
    iconColor,
    onChange,
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Radio",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const ctx = useRadioGroupContext();
  const contextSize = ctx?.size ?? size;
  const componentSize = props.size ? size : contextSize;
  const { styleProps, rest } = extractStyleProps(others);
  const uuid = useId(id);
  const contextProps = ctx ? {
    checked: ctx.value === rest.value,
    name: rest.name ?? ctx.name,
    onChange: (event) => {
      ctx.onChange(event);
      onChange?.(event);
    }
  } : {};
  return /* @__PURE__ */ jsx(
    InlineInput,
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
      children: /* @__PURE__ */ jsxs(Box, { ...getStyles("inner"), mod: { "label-position": labelPosition }, children: [
        /* @__PURE__ */ jsx(
          Box,
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
        /* @__PURE__ */ jsx(Icon, { ...getStyles("icon"), "aria-hidden": true })
      ] })
    }
  );
});
Radio.classes = classes;
Radio.displayName = "@mantine/core/Radio";
Radio.Group = RadioGroup;
Radio.Card = RadioCard;
Radio.Indicator = RadioIndicator;

export { Radio };
//# sourceMappingURL=Radio.mjs.map
