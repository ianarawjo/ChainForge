'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
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
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './Kbd.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { size }) => ({
  root: {
    "--kbd-fz": getSize(size, "kbd-fz"),
    "--kbd-padding": getSize(size, "kbd-padding")
  }
}));
const Kbd = factory((_props, ref) => {
  const props = useProps("Kbd", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, ...others } = props;
  const getStyles = useStyles({
    name: "Kbd",
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
  return /* @__PURE__ */ jsx(Box, { component: "kbd", ref, ...getStyles("root"), ...others });
});
Kbd.classes = classes;
Kbd.displayName = "@mantine/core/Kbd";

export { Kbd };
//# sourceMappingURL=Kbd.mjs.map
