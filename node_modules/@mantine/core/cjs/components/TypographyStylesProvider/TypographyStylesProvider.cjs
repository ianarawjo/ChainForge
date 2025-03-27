'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
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
var TypographyStylesProvider_module = require('./TypographyStylesProvider.module.css.cjs');

const defaultProps = {};
const TypographyStylesProvider = factory.factory((_props, ref) => {
  const props = useProps.useProps("TypographyStylesProvider", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "TypographyStylesProvider",
    classes: TypographyStylesProvider_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others });
});
TypographyStylesProvider.classes = TypographyStylesProvider_module;
TypographyStylesProvider.displayName = "@mantine/core/TypographyStylesProvider";

exports.TypographyStylesProvider = TypographyStylesProvider;
//# sourceMappingURL=TypographyStylesProvider.cjs.map
