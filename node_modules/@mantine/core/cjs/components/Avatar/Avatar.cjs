'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
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
var AvatarGroup = require('./AvatarGroup/AvatarGroup.cjs');
var AvatarGroup_context = require('./AvatarGroup/AvatarGroup.context.cjs');
var AvatarPlaceholderIcon = require('./AvatarPlaceholderIcon.cjs');
var getInitialsColor = require('./get-initials-color/get-initials-color.cjs');
var getInitials = require('./get-initials/get-initials.cjs');
var Avatar_module = require('./Avatar.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { size, radius, variant, gradient, color, autoContrast, name, allowedInitialsColors }) => {
    const _color = color === "initials" && typeof name === "string" ? getInitialsColor.getInitialsColor(name, allowedInitialsColors) : color;
    const colors = theme.variantColorResolver({
      color: _color || "gray",
      theme,
      gradient,
      variant: variant || "light",
      autoContrast
    });
    return {
      root: {
        "--avatar-size": getSize.getSize(size, "avatar-size"),
        "--avatar-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--avatar-bg": _color || variant ? colors.background : void 0,
        "--avatar-color": _color || variant ? colors.color : void 0,
        "--avatar-bd": _color || variant ? colors.border : void 0
      }
    };
  }
);
const Avatar = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Avatar", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    src,
    alt,
    radius,
    color,
    gradient,
    imageProps,
    children,
    autoContrast,
    mod,
    name,
    allowedInitialsColors,
    ...others
  } = props;
  const ctx = AvatarGroup_context.useAvatarGroupContext();
  const [error, setError] = React.useState(!src);
  const getStyles = useStyles.useStyles({
    name: "Avatar",
    props,
    classes: Avatar_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  React.useEffect(() => setError(!src), [src]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getStyles("root"),
      mod: [{ "within-group": ctx.withinGroup }, mod],
      ref,
      ...others,
      children: error ? /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("placeholder"), title: alt, children: children || typeof name === "string" && getInitials.getInitials(name) || /* @__PURE__ */ jsxRuntime.jsx(AvatarPlaceholderIcon.AvatarPlaceholderIcon, {}) }) : /* @__PURE__ */ jsxRuntime.jsx(
        "img",
        {
          ...imageProps,
          ...getStyles("image"),
          src,
          alt,
          onError: (event) => {
            setError(true);
            imageProps?.onError?.(event);
          }
        }
      )
    }
  );
});
Avatar.classes = Avatar_module;
Avatar.displayName = "@mantine/core/Avatar";
Avatar.Group = AvatarGroup.AvatarGroup;

exports.Avatar = Avatar;
//# sourceMappingURL=Avatar.cjs.map
