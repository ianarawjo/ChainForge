'use client';
import { jsx } from 'react/jsx-runtime';
import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_THEME } from '../default-theme.mjs';
import { mergeMantineTheme } from '../merge-mantine-theme/merge-mantine-theme.mjs';

const MantineThemeContext = createContext(null);
const useSafeMantineTheme = () => useContext(MantineThemeContext) || DEFAULT_THEME;
function useMantineTheme() {
  const ctx = useContext(MantineThemeContext);
  if (!ctx) {
    throw new Error(
      "@mantine/core: MantineProvider was not found in component tree, make sure you have it in your app"
    );
  }
  return ctx;
}
function MantineThemeProvider({
  theme,
  children,
  inherit = true
}) {
  const parentTheme = useSafeMantineTheme();
  const mergedTheme = useMemo(
    () => mergeMantineTheme(inherit ? parentTheme : DEFAULT_THEME, theme),
    [theme, parentTheme, inherit]
  );
  return /* @__PURE__ */ jsx(MantineThemeContext.Provider, { value: mergedTheme, children });
}
MantineThemeProvider.displayName = "@mantine/core/MantineThemeProvider";

export { MantineThemeContext, MantineThemeProvider, useMantineTheme, useSafeMantineTheme };
//# sourceMappingURL=MantineThemeProvider.mjs.map
