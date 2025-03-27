'use client';
import { jsx } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { getSize, getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { AvatarGroup } from './AvatarGroup/AvatarGroup.mjs';
import { useAvatarGroupContext } from './AvatarGroup/AvatarGroup.context.mjs';
import { AvatarPlaceholderIcon } from './AvatarPlaceholderIcon.mjs';
import { getInitialsColor } from './get-initials-color/get-initials-color.mjs';
import { getInitials } from './get-initials/get-initials.mjs';
import classes from './Avatar.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
  (theme, { size, radius, variant, gradient, color, autoContrast, name, allowedInitialsColors }) => {
    const _color = color === "initials" && typeof name === "string" ? getInitialsColor(name, allowedInitialsColors) : color;
    const colors = theme.variantColorResolver({
      color: _color || "gray",
      theme,
      gradient,
      variant: variant || "light",
      autoContrast
    });
    return {
      root: {
        "--avatar-size": getSize(size, "avatar-size"),
        "--avatar-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--avatar-bg": _color || variant ? colors.background : void 0,
        "--avatar-color": _color || variant ? colors.color : void 0,
        "--avatar-bd": _color || variant ? colors.border : void 0
      }
    };
  }
);
const Avatar = polymorphicFactory((_props, ref) => {
  const props = useProps("Avatar", defaultProps, _props);
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
  const ctx = useAvatarGroupContext();
  const [error, setError] = useState(!src);
  const getStyles = useStyles({
    name: "Avatar",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  useEffect(() => setError(!src), [src]);
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...getStyles("root"),
      mod: [{ "within-group": ctx.withinGroup }, mod],
      ref,
      ...others,
      children: error ? /* @__PURE__ */ jsx("span", { ...getStyles("placeholder"), title: alt, children: children || typeof name === "string" && getInitials(name) || /* @__PURE__ */ jsx(AvatarPlaceholderIcon, {}) }) : /* @__PURE__ */ jsx(
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
Avatar.classes = classes;
Avatar.displayName = "@mantine/core/Avatar";
Avatar.Group = AvatarGroup;

export { Avatar };
//# sourceMappingURL=Avatar.mjs.map
