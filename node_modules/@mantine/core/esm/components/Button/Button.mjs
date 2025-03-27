'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getSize, getFontSize, getRadius } from '../../core/utils/get-size/get-size.mjs';
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
import { ButtonGroup } from './ButtonGroup/ButtonGroup.mjs';
import { ButtonGroupSection } from './ButtonGroupSection/ButtonGroupSection.mjs';
import classes from './Button.module.css.mjs';

const loaderTransition = {
  in: { opacity: 1, transform: `translate(-50%, calc(-50% + ${rem(1)}))` },
  out: { opacity: 0, transform: "translate(-50%, -200%)" },
  common: { transformOrigin: "center" },
  transitionProperty: "transform, opacity"
};
const defaultProps = {};
const varsResolver = createVarsResolver(
  (theme, { radius, color, gradient, variant, size, justify, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      gradient,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--button-justify": justify,
        "--button-height": getSize(size, "button-height"),
        "--button-padding-x": getSize(size, "button-padding-x"),
        "--button-fz": size?.includes("compact") ? getFontSize(size.replace("compact-", "")) : getFontSize(size),
        "--button-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--button-bg": color || variant ? colors.background : void 0,
        "--button-hover": color || variant ? colors.hover : void 0,
        "--button-color": colors.color,
        "--button-bd": color || variant ? colors.border : void 0,
        "--button-hover-color": color || variant ? colors.hoverColor : void 0
      }
    };
  }
);
const Button = polymorphicFactory((_props, ref) => {
  const props = useProps("Button", defaultProps, _props);
  const {
    style,
    vars,
    className,
    color,
    disabled,
    children,
    leftSection,
    rightSection,
    fullWidth,
    variant,
    radius,
    loading,
    loaderProps,
    gradient,
    classNames,
    styles,
    unstyled,
    "data-disabled": dataDisabled,
    autoContrast,
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Button",
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
  const hasLeftSection = !!leftSection;
  const hasRightSection = !!rightSection;
  return /* @__PURE__ */ jsxs(
    UnstyledButton,
    {
      ref,
      ...getStyles("root", { active: !disabled && !loading && !dataDisabled }),
      unstyled,
      variant,
      disabled: disabled || loading,
      mod: [
        {
          disabled: disabled || dataDisabled,
          loading,
          block: fullWidth,
          "with-left-section": hasLeftSection,
          "with-right-section": hasRightSection
        },
        mod
      ],
      ...others,
      children: [
        /* @__PURE__ */ jsx(Transition, { mounted: !!loading, transition: loaderTransition, duration: 150, children: (transitionStyles) => /* @__PURE__ */ jsx(Box, { component: "span", ...getStyles("loader", { style: transitionStyles }), "aria-hidden": true, children: /* @__PURE__ */ jsx(
          Loader,
          {
            color: "var(--button-color)",
            size: "calc(var(--button-height) / 1.8)",
            ...loaderProps
          }
        ) }) }),
        /* @__PURE__ */ jsxs("span", { ...getStyles("inner"), children: [
          leftSection && /* @__PURE__ */ jsx(Box, { component: "span", ...getStyles("section"), mod: { position: "left" }, children: leftSection }),
          /* @__PURE__ */ jsx(Box, { component: "span", mod: { loading }, ...getStyles("label"), children }),
          rightSection && /* @__PURE__ */ jsx(Box, { component: "span", ...getStyles("section"), mod: { position: "right" }, children: rightSection })
        ] })
      ]
    }
  );
});
Button.classes = classes;
Button.displayName = "@mantine/core/Button";
Button.Group = ButtonGroup;
Button.GroupSection = ButtonGroupSection;

export { Button };
//# sourceMappingURL=Button.mjs.map
