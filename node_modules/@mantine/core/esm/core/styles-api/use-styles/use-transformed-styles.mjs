'use client';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import { useMantineStylesTransform } from '../../MantineProvider/Mantine.context.mjs';
import '../../MantineProvider/default-theme.mjs';
import '../../MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../MantineProvider/MantineCssVariables/MantineCssVariables.mjs';

function useStylesTransform({ props, stylesCtx, themeName }) {
  const theme = useMantineTheme();
  const stylesTransform = useMantineStylesTransform()?.();
  const getTransformedStyles = (styles) => {
    if (!stylesTransform) {
      return [];
    }
    const transformedStyles = styles.map(
      (style) => stylesTransform(style, { props, theme, ctx: stylesCtx })
    );
    return [
      ...transformedStyles,
      ...themeName.map(
        (n) => stylesTransform(theme.components[n]?.styles, { props, theme, ctx: stylesCtx })
      )
    ].filter(Boolean);
  };
  return {
    getTransformedStyles,
    withStylesTransform: !!stylesTransform
  };
}

export { useStylesTransform };
//# sourceMappingURL=use-transformed-styles.mjs.map
