'use client';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import '../../MantineProvider/Mantine.context.mjs';
import '../../MantineProvider/default-theme.mjs';
import '../../MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { resolveClassNames } from '../use-styles/get-class-name/resolve-class-names/resolve-class-names.mjs';
import { resolveStyles } from '../use-styles/get-style/resolve-styles/resolve-styles.mjs';

function useResolvedStylesApi({
  classNames,
  styles,
  props,
  stylesCtx
}) {
  const theme = useMantineTheme();
  return {
    resolvedClassNames: resolveClassNames({
      theme,
      classNames,
      props,
      stylesCtx: stylesCtx || void 0
    }),
    resolvedStyles: resolveStyles({
      theme,
      styles,
      props,
      stylesCtx: stylesCtx || void 0
    })
  };
}

export { useResolvedStylesApi };
//# sourceMappingURL=use-resolved-styles-api.mjs.map
