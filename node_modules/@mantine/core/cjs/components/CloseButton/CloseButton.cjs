'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
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
require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../UnstyledButton/UnstyledButton.cjs');
var CloseIcon = require('./CloseIcon.cjs');
var CloseButton_module = require('./CloseButton.module.css.cjs');

const defaultProps = {
  variant: "subtle"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size, radius, iconSize }) => ({
  root: {
    "--cb-size": getSize.getSize(size, "cb-size"),
    "--cb-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
    "--cb-icon-size": rem.rem(iconSize)
  }
}));
const CloseButton = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("CloseButton", defaultProps, _props);
  const {
    iconSize,
    children,
    vars,
    radius,
    className,
    classNames,
    style,
    styles,
    unstyled,
    "data-disabled": dataDisabled,
    disabled,
    variant,
    icon,
    mod,
    __staticSelector,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: __staticSelector || "CloseButton",
    props,
    className,
    style,
    classes: CloseButton_module,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ref,
      ...others,
      unstyled,
      variant,
      disabled,
      mod: [{ disabled: disabled || dataDisabled }, mod],
      ...getStyles("root", { variant, active: !disabled && !dataDisabled }),
      children: [
        icon || /* @__PURE__ */ jsxRuntime.jsx(CloseIcon.CloseIcon, {}),
        children
      ]
    }
  );
});
CloseButton.classes = CloseButton_module;
CloseButton.displayName = "@mantine/core/CloseButton";

exports.CloseButton = CloseButton;
//# sourceMappingURL=CloseButton.cjs.map
