'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var localStorageManager = require('./color-scheme-managers/local-storage-manager.cjs');
var Mantine_context = require('./Mantine.context.cjs');
var MantineClasses = require('./MantineClasses/MantineClasses.cjs');
var MantineCssVariables = require('./MantineCssVariables/MantineCssVariables.cjs');
require('react');
require('@mantine/hooks');
var MantineThemeProvider = require('./MantineThemeProvider/MantineThemeProvider.cjs');
var suppressNextjsWarning = require('./suppress-nextjs-warning.cjs');
var useProviderColorScheme = require('./use-mantine-color-scheme/use-provider-color-scheme.cjs');
var useRespectReduceMotion = require('./use-respect-reduce-motion/use-respect-reduce-motion.cjs');

suppressNextjsWarning.suppressNextjsWarning();
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
  colorSchemeManager = localStorageManager.localStorageColorSchemeManager(),
  defaultColorScheme = "light",
  getRootElement = () => document.documentElement,
  cssVariablesResolver,
  forceColorScheme,
  stylesTransform,
  env
}) {
  const { colorScheme, setColorScheme, clearColorScheme } = useProviderColorScheme.useProviderColorScheme({
    defaultColorScheme,
    forceColorScheme,
    manager: colorSchemeManager,
    getRootElement
  });
  useRespectReduceMotion.useRespectReduceMotion({
    respectReducedMotion: theme?.respectReducedMotion || false,
    getRootElement
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Mantine_context.MantineContext.Provider,
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
      children: /* @__PURE__ */ jsxRuntime.jsxs(MantineThemeProvider.MantineThemeProvider, { theme, children: [
        withCssVariables && /* @__PURE__ */ jsxRuntime.jsx(
          MantineCssVariables.MantineCssVariables,
          {
            cssVariablesSelector,
            deduplicateCssVariables
          }
        ),
        withGlobalClasses && /* @__PURE__ */ jsxRuntime.jsx(MantineClasses.MantineClasses, {}),
        children
      ] })
    }
  );
}
MantineProvider.displayName = "@mantine/core/MantineProvider";
function HeadlessMantineProvider({ children, theme }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    Mantine_context.MantineContext.Provider,
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
      children: /* @__PURE__ */ jsxRuntime.jsx(MantineThemeProvider.MantineThemeProvider, { theme, children })
    }
  );
}
HeadlessMantineProvider.displayName = "@mantine/core/HeadlessMantineProvider";

exports.HeadlessMantineProvider = HeadlessMantineProvider;
exports.MantineProvider = MantineProvider;
//# sourceMappingURL=MantineProvider.cjs.map
