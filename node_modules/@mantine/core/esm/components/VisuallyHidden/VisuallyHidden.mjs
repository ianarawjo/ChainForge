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
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './VisuallyHidden.module.css.mjs';

const defaultProps = {};
const VisuallyHidden = factory((_props, ref) => {
  const props = useProps("VisuallyHidden", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, ...others } = props;
  const getStyles = useStyles({
    name: "VisuallyHidden",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled
  });
  return /* @__PURE__ */ jsx(Box, { component: "span", ref, ...getStyles("root"), ...others });
});
VisuallyHidden.classes = classes;
VisuallyHidden.displayName = "@mantine/core/VisuallyHidden";

export { VisuallyHidden };
//# sourceMappingURL=VisuallyHidden.mjs.map
