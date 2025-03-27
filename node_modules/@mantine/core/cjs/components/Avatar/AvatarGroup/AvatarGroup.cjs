'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var AvatarGroup_context = require('./AvatarGroup.context.cjs');
var Avatar_module = require('../Avatar.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { spacing }) => ({
  group: {
    "--ag-spacing": getSize.getSpacing(spacing)
  }
}));
const AvatarGroup = factory.factory((_props, ref) => {
  const props = useProps.useProps("AvatarGroup", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, spacing, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "AvatarGroup",
    classes: Avatar_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "group"
  });
  return /* @__PURE__ */ jsxRuntime.jsx(AvatarGroup_context.AvatarGroupProvider, { value: true, children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("group"), ...others }) });
});
AvatarGroup.classes = Avatar_module;
AvatarGroup.displayName = "@mantine/core/AvatarGroup";

exports.AvatarGroup = AvatarGroup;
//# sourceMappingURL=AvatarGroup.cjs.map
