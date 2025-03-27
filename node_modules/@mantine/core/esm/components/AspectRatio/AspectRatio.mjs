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
import classes from './AspectRatio.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { ratio }) => ({
  root: {
    "--ar-ratio": ratio?.toString()
  }
}));
const AspectRatio = factory((_props, ref) => {
  const props = useProps("AspectRatio", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, ratio, ...others } = props;
  const getStyles = useStyles({
    name: "AspectRatio",
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
  return /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root"), ...others });
});
AspectRatio.classes = classes;
AspectRatio.displayName = "@mantine/core/AspectRatio";

export { AspectRatio };
//# sourceMappingURL=AspectRatio.mjs.map
