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
import { useCheckboxCardContext } from '../CheckboxCard/CheckboxCard.context.mjs';
import { CheckboxIcon } from '../CheckIcon.mjs';
import classes from './CheckboxIndicator.module.css.mjs';

const defaultProps = {
  icon: CheckboxIcon
};
const varsResolver = createVarsResolver(
  (theme, { radius, color, size, iconColor, variant, autoContrast }) => {
    const parsedColor = parseThemeColor({ color: color || theme.primaryColor, theme });
    const outlineColor = parsedColor.isThemeColor && parsedColor.shade === void 0 ? `var(--mantine-color-${parsedColor.color}-outline)` : parsedColor.color;
    return {
      indicator: {
        "--checkbox-size": getSize(size, "checkbox-size"),
        "--checkbox-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--checkbox-color": variant === "outline" ? outlineColor : getThemeColor(color, theme),
        "--checkbox-icon-color": iconColor ? getThemeColor(iconColor, theme) : getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0
      }
    };
  }
);
const CheckboxIndicator = factory((_props, ref) => {
  const props = useProps("CheckboxIndicator", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    icon,
    indeterminate,
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
    name: "CheckboxIndicator",
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
  const ctx = useCheckboxCardContext();
  const _checked = typeof checked === "boolean" || typeof indeterminate === "boolean" ? checked || indeterminate : ctx?.checked || false;
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...getStyles("indicator", { variant }),
      variant,
      mod: [{ checked: _checked, disabled }, mod],
      ...others,
      children: /* @__PURE__ */ jsx(Icon, { indeterminate, ...getStyles("icon") })
    }
  );
});
CheckboxIndicator.displayName = "@mantine/core/CheckboxIndicator";
CheckboxIndicator.classes = classes;

export { CheckboxIndicator };
//# sourceMappingURL=CheckboxIndicator.mjs.map
