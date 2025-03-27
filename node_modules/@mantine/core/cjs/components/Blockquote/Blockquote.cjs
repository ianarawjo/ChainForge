'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var parseThemeColor = require('../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.cjs');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var rgba = require('../../core/MantineProvider/color-functions/rgba/rgba.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Blockquote_module = require('./Blockquote.module.css.cjs');

const defaultProps = {
  iconSize: 48
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { color, iconSize, radius }) => {
  const darkParsed = parseThemeColor.parseThemeColor({
    color: color || theme.primaryColor,
    theme,
    colorScheme: "dark"
  });
  const lightParsed = parseThemeColor.parseThemeColor({
    color: color || theme.primaryColor,
    theme,
    colorScheme: "light"
  });
  return {
    root: {
      "--bq-bg-light": rgba.rgba(lightParsed.value, 0.07),
      "--bq-bg-dark": rgba.rgba(darkParsed.value, 0.06),
      "--bq-bd": getThemeColor.getThemeColor(color, theme),
      "--bq-icon-size": rem.rem(iconSize),
      "--bq-radius": getSize.getRadius(radius)
    }
  };
});
const Blockquote = factory.factory((_props, ref) => {
  const props = useProps.useProps("Blockquote", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    icon,
    iconSize,
    cite,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Blockquote",
    classes: Blockquote_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { component: "blockquote", ref, ...getStyles("root"), ...others, children: [
    icon && /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("icon"), children: icon }),
    children,
    cite && /* @__PURE__ */ jsxRuntime.jsx("cite", { ...getStyles("cite"), children: cite })
  ] });
});
Blockquote.classes = Blockquote_module;
Blockquote.displayName = "@mantine/core/Blockquote";

exports.Blockquote = Blockquote;
//# sourceMappingURL=Blockquote.cjs.map
