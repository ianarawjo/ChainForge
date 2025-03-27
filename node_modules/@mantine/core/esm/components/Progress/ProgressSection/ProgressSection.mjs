'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { getContrastColor } from '../../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.mjs';
import { getAutoContrastValue } from '../../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useProgressContext } from '../Progress.context.mjs';
import classes from '../Progress.module.css.mjs';

const defaultProps = {
  withAria: true
};
const ProgressSection = factory((props, ref) => {
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    value,
    withAria,
    color,
    striped,
    animated,
    mod,
    ...others
  } = useProps("ProgressSection", defaultProps, props);
  const ctx = useProgressContext();
  const theme = useMantineTheme();
  const ariaAttributes = withAria ? {
    role: "progressbar",
    "aria-valuemax": 100,
    "aria-valuemin": 0,
    "aria-valuenow": value,
    "aria-valuetext": `${value}%`
  } : {};
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...ctx.getStyles("section", { className, classNames, styles, style }),
      ...others,
      ...ariaAttributes,
      mod: [{ striped: striped || animated, animated }, mod],
      __vars: {
        "--progress-section-width": `${value}%`,
        "--progress-section-color": getThemeColor(color, theme),
        "--progress-label-color": getAutoContrastValue(ctx.autoContrast, theme) ? getContrastColor({ color, theme, autoContrast: ctx.autoContrast }) : void 0
      }
    }
  );
});
ProgressSection.classes = classes;
ProgressSection.displayName = "@mantine/core/ProgressSection";

export { ProgressSection };
//# sourceMappingURL=ProgressSection.mjs.map
