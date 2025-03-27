'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
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
var Box = require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Loader = require('../Loader/Loader.cjs');
var Transition = require('../Transition/Transition.cjs');
var UnstyledButton = require('../UnstyledButton/UnstyledButton.cjs');
var ActionIconGroup = require('./ActionIconGroup/ActionIconGroup.cjs');
var ActionIconGroupSection = require('./ActionIconGroupSection/ActionIconGroupSection.cjs');
var ActionIcon_module = require('./ActionIcon.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { size, radius, variant, gradient, color, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      gradient,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--ai-size": getSize.getSize(size, "ai-size"),
        "--ai-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--ai-bg": color || variant ? colors.background : void 0,
        "--ai-hover": color || variant ? colors.hover : void 0,
        "--ai-hover-color": color || variant ? colors.hoverColor : void 0,
        "--ai-color": colors.color,
        "--ai-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const ActionIcon = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("ActionIcon", defaultProps, _props);
  const {
    className,
    unstyled,
    variant,
    classNames,
    styles,
    style,
    loading,
    loaderProps,
    size,
    color,
    radius,
    __staticSelector,
    gradient,
    vars,
    children,
    disabled,
    "data-disabled": dataDisabled,
    autoContrast,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: ["ActionIcon", __staticSelector],
    props,
    className,
    style,
    classes: ActionIcon_module,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ...getStyles("root", { active: !disabled && !loading && !dataDisabled }),
      ...others,
      unstyled,
      variant,
      size,
      disabled: disabled || loading,
      ref,
      mod: [{ loading, disabled: disabled || dataDisabled }, mod],
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(Transition.Transition, { mounted: !!loading, transition: "slide-down", duration: 150, children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", ...getStyles("loader", { style: transitionStyles }), "aria-hidden": true, children: /* @__PURE__ */ jsxRuntime.jsx(Loader.Loader, { color: "var(--ai-color)", size: "calc(var(--ai-size) * 0.55)", ...loaderProps }) }) }),
        /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", mod: { loading }, ...getStyles("icon"), children })
      ]
    }
  );
});
ActionIcon.classes = ActionIcon_module;
ActionIcon.displayName = "@mantine/core/ActionIcon";
ActionIcon.Group = ActionIconGroup.ActionIconGroup;
ActionIcon.GroupSection = ActionIconGroupSection.ActionIconGroupSection;

exports.ActionIcon = ActionIcon;
//# sourceMappingURL=ActionIcon.cjs.map
