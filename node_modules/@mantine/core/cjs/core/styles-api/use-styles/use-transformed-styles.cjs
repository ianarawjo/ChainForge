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

function useStylesTransform({ props, stylesCtx, themeName }) {
  const theme = MantineThemeProvider.useMantineTheme();
  const stylesTransform = Mantine_context.useMantineStylesTransform()?.();
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

exports.useStylesTransform = useStylesTransform;
//# sourceMappingURL=use-transformed-styles.cjs.map
