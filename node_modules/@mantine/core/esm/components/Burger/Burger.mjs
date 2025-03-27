'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../UnstyledButton/UnstyledButton.mjs';
import classes from './Burger.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
  (theme, { color, size, lineSize, transitionDuration, transitionTimingFunction }) => ({
    root: {
      "--burger-color": color ? getThemeColor(color, theme) : void 0,
      "--burger-size": getSize(size, "burger-size"),
      "--burger-line-size": lineSize ? rem(lineSize) : void 0,
      "--burger-transition-duration": transitionDuration === void 0 ? void 0 : `${transitionDuration}ms`,
      "--burger-transition-timing-function": transitionTimingFunction
    }
  })
);
const Burger = factory((_props, ref) => {
  const props = useProps("Burger", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    opened,
    children,
    transitionDuration,
    transitionTimingFunction,
    lineSize,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Burger",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxs(UnstyledButton, { ...getStyles("root"), ref, ...others, children: [
    /* @__PURE__ */ jsx(Box, { mod: ["reduce-motion", { opened }], ...getStyles("burger") }),
    children
  ] });
});
Burger.classes = classes;
Burger.displayName = "@mantine/core/Burger";

export { Burger };
//# sourceMappingURL=Burger.mjs.map
