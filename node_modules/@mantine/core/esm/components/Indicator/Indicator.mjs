'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
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
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { getPositionVariables } from './get-position-variables/get-position-variables.mjs';
import classes from './Indicator.module.css.mjs';

const defaultProps = {
  position: "top-end",
  offset: 0,
  inline: false,
  withBorder: false,
  disabled: false,
  processing: false
};
const varsResolver = createVarsResolver(
  (theme, { color, position, offset, size, radius, zIndex, autoContrast }) => ({
    root: {
      "--indicator-color": color ? getThemeColor(color, theme) : void 0,
      "--indicator-text-color": getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0,
      "--indicator-size": rem(size),
      "--indicator-radius": radius === void 0 ? void 0 : getRadius(radius),
      "--indicator-z-index": zIndex?.toString(),
      ...getPositionVariables(position, offset)
    }
  })
);
const Indicator = factory((_props, ref) => {
  const props = useProps("Indicator", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Indicator",
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
  return /* @__PURE__ */ jsxs(Box, { ref, ...getStyles("root"), mod: [{ inline }, mod], ...others, children: [
    !disabled && /* @__PURE__ */ jsx(
      Box,
      {
        mod: { "with-label": !!label, "with-border": withBorder, processing },
        ...getStyles("indicator"),
        children: label
      }
    ),
    children
  ] });
});
Indicator.classes = classes;
Indicator.displayName = "@mantine/core/Indicator";

export { Indicator };
//# sourceMappingURL=Indicator.mjs.map
