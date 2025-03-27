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
var VisuallyHidden_module = require('./VisuallyHidden.module.css.cjs');

const defaultProps = {};
const VisuallyHidden = factory.factory((_props, ref) => {
  const props = useProps.useProps("VisuallyHidden", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "VisuallyHidden",
    classes: VisuallyHidden_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", ref, ...getStyles("root"), ...others });
});
VisuallyHidden.classes = VisuallyHidden_module;
VisuallyHidden.displayName = "@mantine/core/VisuallyHidden";

exports.VisuallyHidden = VisuallyHidden;
//# sourceMappingURL=VisuallyHidden.cjs.map
