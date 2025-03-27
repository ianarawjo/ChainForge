'use client';
import { jsx } from 'react/jsx-runtime';

const getScript = ({
  defaultColorScheme,
  localStorageKey,
  forceColorScheme
}) => forceColorScheme ? `document.documentElement.setAttribute("data-mantine-color-scheme", '${forceColorScheme}');` : `try {
  var _colorScheme = window.localStorage.getItem("${localStorageKey}");
  var colorScheme = _colorScheme === "light" || _colorScheme === "dark" || _colorScheme === "auto" ? _colorScheme : "${defaultColorScheme}";
  var computedColorScheme = colorScheme !== "auto" ? colorScheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computedColorScheme);
} catch (e) {}
`;
function ColorSchemeScript({
  defaultColorScheme = "light",
  localStorageKey = "mantine-color-scheme-value",
  forceColorScheme,
  ...others
}) {
  const _defaultColorScheme = ["light", "dark", "auto"].includes(defaultColorScheme) ? defaultColorScheme : "light";
  return /* @__PURE__ */ jsx(
    "script",
    {
      ...others,
      "data-mantine-script": true,
      dangerouslySetInnerHTML: {
        __html: getScript({
          defaultColorScheme: _defaultColorScheme,
          localStorageKey,
          forceColorScheme
        })
      }
    }
  );
}

export { ColorSchemeScript };
//# sourceMappingURL=ColorSchemeScript.mjs.map
