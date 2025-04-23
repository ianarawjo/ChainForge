import React, { useEffect } from "react";
import { useLocalStorage } from "@mantine/hooks";
import {
  ColorScheme,
  ColorSchemeProvider,
  useMantineColorScheme,
  MantineProvider,
  Group,
  Switch,
} from "@mantine/core";
import { IconMoon, IconSunHigh } from "@tabler/icons-react";

/**
 * Tries to detect the user's OS color scheme preference.
 * If the browser does not support the `prefers-color-scheme` media query,
 * it will return `undefined`.
 */
function getOSPreferredColorScheme(): "dark" | "light" | undefined {
  if (
    window !== undefined &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme)").media !== "not all"
  ) {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    return prefersDark ? "dark" : "light";
  } else {
    console.log("prefers-color-scheme not supported");
    return undefined;
  }
}

export default function ColorThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: "mantine-color-scheme",
    defaultValue: getOSPreferredColorScheme() ?? "light",
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

export function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";

  return (
    <Group position="center">
      <Switch
        description="Color theme"
        checked={dark}
        onChange={() => toggleColorScheme()}
        color="gray"
        size="md"
        onLabel={<IconMoon size={16} style={{ color: "cyan" }} />}
        offLabel={<IconSunHigh size={16} style={{ color: "OrangeRed" }} />}
      />
    </Group>
  );
}
