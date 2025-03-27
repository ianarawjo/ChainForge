'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize, getFontSize, getRadius } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import classes from '../ActionIcon.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
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
        "--section-height": getSize(size, "section-height"),
        "--section-padding-x": getSize(size, "section-padding-x"),
        "--section-fz": getFontSize(size),
        "--section-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--section-bg": color || variant ? colors.background : void 0,
        "--section-color": colors.color,
        "--section-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const ActionIconGroupSection = factory((_props, ref) => {
  const props = useProps("ActionIconGroupSection", defaultProps, _props);
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
  } = useProps("ActionIconGroupSection", defaultProps, _props);
  const getStyles = useStyles({
    name: "ActionIconGroupSection",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "groupSection"
  });
  return /* @__PURE__ */ jsx(Box, { ...getStyles("groupSection"), ref, variant, ...others });
});
ActionIconGroupSection.classes = classes;
ActionIconGroupSection.displayName = "@mantine/core/ActionIconGroupSection";

export { ActionIconGroupSection };
//# sourceMappingURL=ActionIconGroupSection.mjs.map
