'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../../core/utils/units-converters/rem.cjs');
require('react');
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
var ActionIcon_module = require('../ActionIcon.module.css.cjs');

const defaultProps = {
  orientation: "horizontal"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { borderWidth }) => ({
  group: { "--ai-border-width": rem.rem(borderWidth) }
}));
const ActionIconGroup = factory.factory((_props, ref) => {
  const props = useProps.useProps("ActionIconGroup", defaultProps, _props);
  const {
    className,
    style,
    classNames,
    styles,
    unstyled,
    orientation,
    vars,
    borderWidth,
    variant,
    mod,
    ...others
  } = useProps.useProps("ActionIconGroup", defaultProps, _props);
  const getStyles = useStyles.useStyles({
    name: "ActionIconGroup",
    props,
    classes: ActionIcon_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "group"
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getStyles("group"),
      ref,
      variant,
      mod: [{ "data-orientation": orientation }, mod],
      role: "group",
      ...others
    }
  );
});
ActionIconGroup.classes = ActionIcon_module;
ActionIconGroup.displayName = "@mantine/core/ActionIconGroup";

exports.ActionIconGroup = ActionIconGroup;
//# sourceMappingURL=ActionIconGroup.cjs.map
