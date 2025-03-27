'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
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
import { Box } from '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Loader } from '../Loader/Loader.mjs';
import { Transition } from '../Transition/Transition.mjs';
import { UnstyledButton } from '../UnstyledButton/UnstyledButton.mjs';
import { ActionIconGroup } from './ActionIconGroup/ActionIconGroup.mjs';
import { ActionIconGroupSection } from './ActionIconGroupSection/ActionIconGroupSection.mjs';
import classes from './ActionIcon.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
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
        "--ai-size": getSize(size, "ai-size"),
        "--ai-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--ai-bg": color || variant ? colors.background : void 0,
        "--ai-hover": color || variant ? colors.hover : void 0,
        "--ai-hover-color": color || variant ? colors.hoverColor : void 0,
        "--ai-color": colors.color,
        "--ai-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const ActionIcon = polymorphicFactory((_props, ref) => {
  const props = useProps("ActionIcon", defaultProps, _props);
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
  const getStyles = useStyles({
    name: ["ActionIcon", __staticSelector],
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
      ...getStyles("root", { active: !disabled && !loading && !dataDisabled }),
      ...others,
      unstyled,
      variant,
      size,
      disabled: disabled || loading,
      ref,
      mod: [{ loading, disabled: disabled || dataDisabled }, mod],
      children: [
        /* @__PURE__ */ jsx(Transition, { mounted: !!loading, transition: "slide-down", duration: 150, children: (transitionStyles) => /* @__PURE__ */ jsx(Box, { component: "span", ...getStyles("loader", { style: transitionStyles }), "aria-hidden": true, children: /* @__PURE__ */ jsx(Loader, { color: "var(--ai-color)", size: "calc(var(--ai-size) * 0.55)", ...loaderProps }) }) }),
        /* @__PURE__ */ jsx(Box, { component: "span", mod: { loading }, ...getStyles("icon"), children })
      ]
    }
  );
});
ActionIcon.classes = classes;
ActionIcon.displayName = "@mantine/core/ActionIcon";
ActionIcon.Group = ActionIconGroup;
ActionIcon.GroupSection = ActionIconGroupSection;

export { ActionIcon };
//# sourceMappingURL=ActionIcon.mjs.map
