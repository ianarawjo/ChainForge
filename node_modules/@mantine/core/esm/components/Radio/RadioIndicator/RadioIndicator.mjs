'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize, getRadius } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { parseThemeColor } from '../../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.mjs';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { getContrastColor } from '../../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.mjs';
import { getAutoContrastValue } from '../../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useRadioCardContext } from '../RadioCard/RadioCard.context.mjs';
import { RadioIcon } from '../RadioIcon.mjs';
import classes from './RadioIndicator.module.css.mjs';

const defaultProps = {
  icon: RadioIcon
};
const varsResolver = createVarsResolver(
  (theme, { radius, color, size, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      indicator: {
        "--radio-size": getSize(size, "radio-size"),
        "--radio-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--radio-color": variant === "outline" ? outlineColor : getThemeColor(color, theme),
        "--radio-icon-size": getSize(size, "radio-icon-size"),
        "--radio-icon-color": iconColor ? getThemeColor(iconColor, theme) : getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0
      }
    };
  }
);
const RadioIndicator = factory((_props, ref) => {
  const props = useProps("RadioIndicator", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "RadioIndicator",
    classes,
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
  const ctx = useRadioCardContext();
  const _checked = typeof checked === "boolean" ? checked : ctx?.checked || false;
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...getStyles("indicator", { variant }),
      variant,
      mod: [{ checked: _checked, disabled }, mod],
      ...others,
      children: /* @__PURE__ */ jsx(Icon, { ...getStyles("icon") })
    }
  );
});
RadioIndicator.displayName = "@mantine/core/RadioIndicator";
RadioIndicator.classes = classes;

export { RadioIndicator };
//# sourceMappingURL=RadioIndicator.mjs.map
