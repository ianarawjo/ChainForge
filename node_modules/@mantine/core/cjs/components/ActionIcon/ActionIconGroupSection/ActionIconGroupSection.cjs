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
var ActionIcon_module = require('../ActionIcon.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { radius, color, gradient, variant, autoContrast, size }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      gradient,
      variant: variant || "filled",
      autoContrast
    });
    return {
      groupSection: {
        "--section-height": getSize.getSize(size, "section-height"),
        "--section-padding-x": getSize.getSize(size, "section-padding-x"),
        "--section-fz": getSize.getFontSize(size),
        "--section-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--section-bg": color || variant ? colors.background : void 0,
        "--section-color": colors.color,
        "--section-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const ActionIconGroupSection = factory.factory((_props, ref) => {
  const props = useProps.useProps("ActionIconGroupSection", defaultProps, _props);
  const {
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    variant,
    gradient,
    radius,
    autoContrast,
    ...others
  } = useProps.useProps("ActionIconGroupSection", defaultProps, _props);
  const getStyles = useStyles.useStyles({
    name: "ActionIconGroupSection",
    props,
    classes: ActionIcon_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "groupSection"
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...getStyles("groupSection"), ref, variant, ...others });
});
ActionIconGroupSection.classes = ActionIcon_module;
ActionIconGroupSection.displayName = "@mantine/core/ActionIconGroupSection";

exports.ActionIconGroupSection = ActionIconGroupSection;
//# sourceMappingURL=ActionIconGroupSection.cjs.map
