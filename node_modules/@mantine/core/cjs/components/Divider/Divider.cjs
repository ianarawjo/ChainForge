'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
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
var Divider_module = require('./Divider.module.css.cjs');

const defaultProps = {
  orientation: "horizontal"
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { color, variant, size }) => ({
  root: {
    "--divider-color": color ? getThemeColor.getThemeColor(color, theme) : void 0,
    "--divider-border-style": variant,
    "--divider-size": getSize.getSize(size, "divider-size")
  }
}));
const Divider = factory.factory((_props, ref) => {
  const props = useProps.useProps("Divider", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    orientation,
    label,
    labelPosition,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Divider",
    classes: Divider_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      mod: [{ orientation, "with-label": !!label }, mod],
      ...getStyles("root"),
      ...others,
      role: "separator",
      children: label && /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", mod: { position: labelPosition }, ...getStyles("label"), children: label })
    }
  );
});
Divider.classes = Divider_module;
Divider.displayName = "@mantine/core/Divider";

exports.Divider = Divider;
//# sourceMappingURL=Divider.cjs.map
