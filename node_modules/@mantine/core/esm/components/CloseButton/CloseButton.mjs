'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
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
import '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../UnstyledButton/UnstyledButton.mjs';
import { CloseIcon } from './CloseIcon.mjs';
import classes from './CloseButton.module.css.mjs';

const defaultProps = {
  variant: "subtle"
};
const varsResolver = createVarsResolver((_, { size, radius, iconSize }) => ({
  root: {
    "--cb-size": getSize(size, "cb-size"),
    "--cb-radius": radius === void 0 ? void 0 : getRadius(radius),
    "--cb-icon-size": rem(iconSize)
  }
}));
const CloseButton = polymorphicFactory((_props, ref) => {
  const props = useProps("CloseButton", defaultProps, _props);
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
  const getStyles = useStyles({
    name: __staticSelector || "CloseButton",
    props,
    className,
    style,
    classes,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxs(
    UnstyledButton,
    {
      ref,
      ...others,
      unstyled,
      variant,
      disabled,
      mod: [{ disabled: disabled || dataDisabled }, mod],
      ...getStyles("root", { variant, active: !disabled && !dataDisabled }),
      children: [
        icon || /* @__PURE__ */ jsx(CloseIcon, {}),
        children
      ]
    }
  );
});
CloseButton.classes = classes;
CloseButton.displayName = "@mantine/core/CloseButton";

export { CloseButton };
//# sourceMappingURL=CloseButton.mjs.map
