import React, { useEffect } from "react";
import { useLocalStorage } from "@mantine/hooks";
import {
  ColorScheme,
  ColorSchemeProvider,
  MantineProvider,
} from "@mantine/core";

export default function ColorThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: "mantine-color-scheme",
    defaultValue: "dark",
    getInitialValueInEffect: true,
  });

  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === "dark" ? "light" : "dark"));

  // Set data-mantine-color-scheme manually
  // NOTE: This is a workaround for the issue where MantineProvider in Mantine 6 does not set the attribute on the html element.
  // When we upgrade to Mantine 7, we can remove this useEffect and will need to change more code most likely.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-mantine-color-scheme",
      colorScheme,
    );
  }, [colorScheme]);

  return (
    <ColorSchemeProvider
      colorScheme={colorScheme}
      toggleColorScheme={toggleColorScheme}
    >
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{ colorScheme }}
      >
        {children}
      </MantineProvider>
    </ColorSchemeProvider>
  );
}
