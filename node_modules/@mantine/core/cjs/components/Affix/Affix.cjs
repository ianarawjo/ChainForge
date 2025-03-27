'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
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
require('../Portal/Portal.cjs');
var OptionalPortal = require('../Portal/OptionalPortal.cjs');
var Affix_module = require('./Affix.module.css.cjs');

const defaultProps = {
  position: { bottom: 0, right: 0 },
  zIndex: getDefaultZIndex.getDefaultZIndex("modal"),
  withinPortal: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, { zIndex, position }) => ({
  root: {
    "--affix-z-index": zIndex?.toString(),
    "--affix-top": getSize.getSpacing(position?.top),
    "--affix-left": getSize.getSpacing(position?.left),
    "--affix-bottom": getSize.getSpacing(position?.bottom),
    "--affix-right": getSize.getSpacing(position?.right)
  }
}));
const Affix = factory.factory((_props, ref) => {
  const props = useProps.useProps("Affix", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    portalProps,
    zIndex,
    withinPortal,
    position,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Affix",
    classes: Affix_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(OptionalPortal.OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others }) });
});
Affix.classes = Affix_module;
Affix.displayName = "@mantine/core/Affix";

exports.Affix = Affix;
//# sourceMappingURL=Affix.cjs.map
