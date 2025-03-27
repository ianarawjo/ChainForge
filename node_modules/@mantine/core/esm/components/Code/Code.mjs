'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
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
import classes from './Code.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((theme, { color }) => ({
  root: {
    "--code-bg": color ? getThemeColor(color, theme) : void 0
  }
}));
const Code = factory((_props, ref) => {
  const props = useProps("Code", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    block,
    variant,
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Code",
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
  return /* @__PURE__ */ jsx(
    Box,
    {
      component: block ? "pre" : "code",
      variant,
      ref,
      mod: [{ block }, mod],
      ...getStyles("root"),
      ...others,
      dir: "ltr"
    }
  );
});
Code.classes = classes;
Code.displayName = "@mantine/core/Code";

export { Code };
//# sourceMappingURL=Code.mjs.map
