'use client';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import { useMantineClassNamesPrefix, useMantineWithStaticClasses, useMantineIsHeadless } from '../../MantineProvider/Mantine.context.mjs';
import '../../MantineProvider/default-theme.mjs';
import '../../MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { getClassName } from './get-class-name/get-class-name.mjs';
import { getStyle } from './get-style/get-style.mjs';
import { useStylesTransform } from './use-transformed-styles.mjs';

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
  const theme = useMantineTheme();
  const classNamesPrefix = useMantineClassNamesPrefix();
  const withStaticClasses = useMantineWithStaticClasses();
  const headless = useMantineIsHeadless();
  const themeName = (Array.isArray(name) ? name : [name]).filter((n) => n);
  const { withStylesTransform, getTransformedStyles } = useStylesTransform({
    props,
    stylesCtx,
    themeName
  });
  return (selector, options) => ({
    className: getClassName({
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
    style: getStyle({
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

export { useStyles };
//# sourceMappingURL=use-styles.mjs.map
