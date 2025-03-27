'use client';
'use strict';

require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var Mantine_context = require('../../MantineProvider/Mantine.context.cjs');
require('../../MantineProvider/default-theme.cjs');
require('../../MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var getClassName = require('./get-class-name/get-class-name.cjs');
var getStyle = require('./get-style/get-style.cjs');
var useTransformedStyles = require('./use-transformed-styles.cjs');

function useStyles({
  name,
  classes,
  props,
  stylesCtx,
  className,
  style,
  rootSelector = "root",
  unstyled,
  classNames,
  styles,
  vars,
  varsResolver
}) {
  const theme = MantineThemeProvider.useMantineTheme();
  const classNamesPrefix = Mantine_context.useMantineClassNamesPrefix();
  const withStaticClasses = Mantine_context.useMantineWithStaticClasses();
  const headless = Mantine_context.useMantineIsHeadless();
  const themeName = (Array.isArray(name) ? name : [name]).filter((n) => n);
  const { withStylesTransform, getTransformedStyles } = useTransformedStyles.useStylesTransform({
    props,
    stylesCtx,
    themeName
  });
  return (selector, options) => ({
    className: getClassName.getClassName({
      theme,
      options,
      themeName,
      selector,
      classNamesPrefix,
      classNames,
      classes,
      unstyled,
      className,
      rootSelector,
      props,
      stylesCtx,
      withStaticClasses,
      headless,
      transformedStyles: getTransformedStyles([options?.styles, styles])
    }),
    style: getStyle.getStyle({
      theme,
      themeName,
      selector,
      options,
      props,
      stylesCtx,
      rootSelector,
      styles,
      style,
      vars,
      varsResolver,
      headless,
      withStylesTransform
    })
  });
}

exports.useStyles = useStyles;
//# sourceMappingURL=use-styles.cjs.map
