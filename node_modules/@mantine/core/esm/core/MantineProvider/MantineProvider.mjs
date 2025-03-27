'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { localStorageColorSchemeManager } from './color-scheme-managers/local-storage-manager.mjs';
import { MantineContext } from './Mantine.context.mjs';
import { MantineClasses } from './MantineClasses/MantineClasses.mjs';
import { MantineCssVariables } from './MantineCssVariables/MantineCssVariables.mjs';
import 'react';
import '@mantine/hooks';
import { MantineThemeProvider } from './MantineThemeProvider/MantineThemeProvider.mjs';
import { suppressNextjsWarning } from './suppress-nextjs-warning.mjs';
import { useProviderColorScheme } from './use-mantine-color-scheme/use-provider-color-scheme.mjs';
import { useRespectReduceMotion } from './use-respect-reduce-motion/use-respect-reduce-motion.mjs';

suppressNextjsWarning();
function MantineProvider({
  theme,
  children,
  getStyleNonce,
  withStaticClasses = true,
  withGlobalClasses = true,
  deduplicateCssVariables = true,
  withCssVariables = true,
  cssVariablesSelector = ":root",
  classNamesPrefix = "mantine",
  colorSchemeManager = localStorageColorSchemeManager(),
  defaultColorScheme = "light",
  getRootElement = () => document.documentElement,
  cssVariablesResolver,
  forceColorScheme,
  stylesTransform,
  env
}) {
  const { colorScheme, setColorScheme, clearColorScheme } = useProviderColorScheme({
    defaultColorScheme,
    forceColorScheme,
    manager: colorSchemeManager,
    getRootElement
  });
  useRespectReduceMotion({
    respectReducedMotion: theme?.respectReducedMotion || false,
    getRootElement
  });
  return /* @__PURE__ */ jsx(
    MantineContext.Provider,
    {
      value: {
        colorScheme,
        setColorScheme,
        clearColorScheme,
        getRootElement,
        classNamesPrefix,
        getStyleNonce,
        cssVariablesResolver,
        cssVariablesSelector,
        withStaticClasses,
        stylesTransform,
        env
      },
      children: /* @__PURE__ */ jsxs(MantineThemeProvider, { theme, children: [
        withCssVariables && /* @__PURE__ */ jsx(
          MantineCssVariables,
          {
            cssVariablesSelector,
            deduplicateCssVariables
          }
        ),
        withGlobalClasses && /* @__PURE__ */ jsx(MantineClasses, {}),
        children
      ] })
    }
  );
}
MantineProvider.displayName = "@mantine/core/MantineProvider";
function HeadlessMantineProvider({ children, theme }) {
  return /* @__PURE__ */ jsx(
    MantineContext.Provider,
    {
      value: {
        colorScheme: "auto",
        setColorScheme: () => {
        },
        clearColorScheme: () => {
        },
        getRootElement: () => document.documentElement,
        classNamesPrefix: "mantine",
        cssVariablesSelector: ":root",
        withStaticClasses: false,
        headless: true
      },
      children: /* @__PURE__ */ jsx(MantineThemeProvider, { theme, children })
    }
  );
}
HeadlessMantineProvider.displayName = "@mantine/core/HeadlessMantineProvider";

export { HeadlessMantineProvider, MantineProvider };
//# sourceMappingURL=MantineProvider.mjs.map
