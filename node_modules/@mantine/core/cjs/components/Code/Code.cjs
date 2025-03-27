'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
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
var Code_module = require('./Code.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((theme, { color }) => ({
  root: {
    "--code-bg": color ? getThemeColor.getThemeColor(color, theme) : void 0
  }
}));
const Code = factory.factory((_props, ref) => {
  const props = useProps.useProps("Code", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    block,
    variant,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Code",
    props,
    classes: Code_module,
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
      component: block ? "pre" : "code",
      variant,
      ref,
      mod: [{ block }, mod],
      ...getStyles("root"),
      ...others,
      dir: "ltr"
    }
  );
});
Code.classes = Code_module;
Code.displayName = "@mantine/core/Code";

exports.Code = Code;
//# sourceMappingURL=Code.cjs.map
