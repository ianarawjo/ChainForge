'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
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
import classes from './Center.module.css.mjs';

const defaultProps = {};
const Center = polymorphicFactory((_props, ref) => {
  const props = useProps("Center", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, inline, mod, ...others } = props;
  const getStyles = useStyles({
    name: "Center",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars
  });
  return /* @__PURE__ */ jsx(Box, { ref, mod: [{ inline }, mod], ...getStyles("root"), ...others });
});
Center.classes = classes;
Center.displayName = "@mantine/core/Center";

export { Center };
//# sourceMappingURL=Center.mjs.map
