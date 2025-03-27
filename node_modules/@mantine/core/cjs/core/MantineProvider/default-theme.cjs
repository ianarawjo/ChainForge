'use strict';

var rem = require('../utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var defaultVariantColorsResolver = require('./color-functions/default-variant-colors-resolver/default-variant-colors-resolver.cjs');
var defaultColors = require('./default-colors.cjs');

const DEFAULT_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji";
const DEFAULT_THEME = {
  scale: 1,
  fontSmoothing: true,
  focusRing: "auto",
  white: "#fff",
  black: "#000",
  colors: defaultColors.DEFAULT_COLORS,
  primaryShade: { light: 6, dark: 8 },
  primaryColor: "blue",
  variantColorResolver: defaultVariantColorsResolver.defaultVariantColorsResolver,
  autoContrast: false,
  luminanceThreshold: 0.3,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  respectReducedMotion: false,
  cursorType: "default",
  defaultGradient: { from: "blue", to: "cyan", deg: 45 },
  defaultRadius: "sm",
  activeClassName: "mantine-active",
  focusClassName: "",
  headings: {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: "700",
    textWrap: "wrap",
    sizes: {
      h1: { fontSize: rem.rem(34), lineHeight: "1.3" },
      h2: { fontSize: rem.rem(26), lineHeight: "1.35" },
      h3: { fontSize: rem.rem(22), lineHeight: "1.4" },
      h4: { fontSize: rem.rem(18), lineHeight: "1.45" },
      h5: { fontSize: rem.rem(16), lineHeight: "1.5" },
      h6: { fontSize: rem.rem(14), lineHeight: "1.5" }
    }
  },
  fontSizes: {
    xs: rem.rem(12),
    sm: rem.rem(14),
    md: rem.rem(16),
    lg: rem.rem(18),
    xl: rem.rem(20)
  },
  lineHeights: {
    xs: "1.4",
    sm: "1.45",
    md: "1.55",
    lg: "1.6",
    xl: "1.65"
  },
  radius: {
    xs: rem.rem(2),
    sm: rem.rem(4),
    md: rem.rem(8),
    lg: rem.rem(16),
    xl: rem.rem(32)
  },
  spacing: {
    xs: rem.rem(10),
    sm: rem.rem(12),
    md: rem.rem(16),
    lg: rem.rem(20),
    xl: rem.rem(32)
  },
  breakpoints: {
    xs: "36em",
    sm: "48em",
    md: "62em",
    lg: "75em",
    xl: "88em"
  },
  shadows: {
    xs: `0 ${rem.rem(1)} ${rem.rem(3)} rgba(0, 0, 0, 0.05), 0 ${rem.rem(1)} ${rem.rem(2)} rgba(0, 0, 0, 0.1)`,
    sm: `0 ${rem.rem(1)} ${rem.rem(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${rem.rem(10)} ${rem.rem(
      15
    )} ${rem.rem(-5)}, rgba(0, 0, 0, 0.04) 0 ${rem.rem(7)} ${rem.rem(7)} ${rem.rem(-5)}`,
    md: `0 ${rem.rem(1)} ${rem.rem(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${rem.rem(20)} ${rem.rem(
      25
    )} ${rem.rem(-5)}, rgba(0, 0, 0, 0.04) 0 ${rem.rem(10)} ${rem.rem(10)} ${rem.rem(-5)}`,
    lg: `0 ${rem.rem(1)} ${rem.rem(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${rem.rem(28)} ${rem.rem(
      23
    )} ${rem.rem(-7)}, rgba(0, 0, 0, 0.04) 0 ${rem.rem(12)} ${rem.rem(12)} ${rem.rem(-7)}`,
    xl: `0 ${rem.rem(1)} ${rem.rem(3)} rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0 ${rem.rem(36)} ${rem.rem(
      28
    )} ${rem.rem(-7)}, rgba(0, 0, 0, 0.04) 0 ${rem.rem(17)} ${rem.rem(17)} ${rem.rem(-7)}`
  },
  other: {},
  components: {}
};

exports.DEFAULT_THEME = DEFAULT_THEME;
//# sourceMappingURL=default-theme.cjs.map
