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
import classes from './Container.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { size, fluid }) => ({
  root: {
    "--container-size": fluid ? void 0 : getSize(size, "container-size")
  }
}));
const Container = factory((_props, ref) => {
  const props = useProps("Container", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, fluid, mod, ...others } = props;
  const getStyles = useStyles({
    name: "Container",
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
  return /* @__PURE__ */ jsx(Box, { ref, mod: [{ fluid }, mod], ...getStyles("root"), ...others });
});
Container.classes = classes;
Container.displayName = "@mantine/core/Container";

export { Container };
//# sourceMappingURL=Container.mjs.map
