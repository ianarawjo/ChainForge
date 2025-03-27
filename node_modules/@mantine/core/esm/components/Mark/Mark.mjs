'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
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
import { getMarkColor } from './get-mark-color.mjs';
import classes from './Mark.module.css.mjs';

const defaultProps = {
  color: "yellow"
};
const varsResolver = createVarsResolver((theme, { color }) => ({
  root: {
    "--mark-bg-dark": getMarkColor({ color, theme, defaultShade: 5 }),
    "--mark-bg-light": getMarkColor({ color, theme, defaultShade: 2 })
  }
}));
const Mark = factory((_props, ref) => {
  const props = useProps("Mark", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, color, variant, ...others } = props;
  const getStyles = useStyles({
    name: "Mark",
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
  return /* @__PURE__ */ jsx(Box, { component: "mark", ref, variant, ...getStyles("root"), ...others });
});
Mark.classes = classes;
Mark.displayName = "@mantine/core/Mark";

export { Mark };
//# sourceMappingURL=Mark.mjs.map
