'use client';
'use strict';

require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
require('../../MantineProvider/Mantine.context.cjs');
require('../../MantineProvider/default-theme.cjs');
require('../../MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var resolveClassNames = require('../use-styles/get-class-name/resolve-class-names/resolve-class-names.cjs');
var resolveStyles = require('../use-styles/get-style/resolve-styles/resolve-styles.cjs');

function useResolvedStylesApi({
  classNames,
  styles,
  props,
  stylesCtx
}) {
  const theme = MantineThemeProvider.useMantineTheme();
  return {
    resolvedClassNames: resolveClassNames.resolveClassNames({
      theme,
      classNames,
      props,
      stylesCtx: stylesCtx || void 0
    }),
    resolvedStyles: resolveStyles.resolveStyles({
      theme,
      styles,
      props,
      stylesCtx: stylesCtx || void 0
    })
  };
}

exports.useResolvedStylesApi = useResolvedStylesApi;
//# sourceMappingURL=use-resolved-styles-api.cjs.map
