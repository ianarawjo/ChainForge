'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var getContrastColor = require('../../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Progress_context = require('../Progress.context.cjs');
var Progress_module = require('../Progress.module.css.cjs');

const defaultProps = {
  withAria: true
};
const ProgressSection = factory.factory((props, ref) => {
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
  } = useProps.useProps("ProgressSection", defaultProps, props);
  const ctx = Progress_context.useProgressContext();
  const theme = MantineThemeProvider.useMantineTheme();
  const ariaAttributes = withAria ? {
    role: "progressbar",
    "aria-valuemax": 100,
    "aria-valuemin": 0,
    "aria-valuenow": value,
    "aria-valuetext": `${value}%`
  } : {};
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      ...ctx.getStyles("section", { className, classNames, styles, style }),
      ...others,
      ...ariaAttributes,
      mod: [{ striped: striped || animated, animated }, mod],
      __vars: {
        "--progress-section-width": `${value}%`,
        "--progress-section-color": getThemeColor.getThemeColor(color, theme),
        "--progress-label-color": getAutoContrastValue.getAutoContrastValue(ctx.autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast: ctx.autoContrast }) : void 0
      }
    }
  );
});
ProgressSection.classes = Progress_module;
ProgressSection.displayName = "@mantine/core/ProgressSection";

exports.ProgressSection = ProgressSection;
//# sourceMappingURL=ProgressSection.cjs.map
