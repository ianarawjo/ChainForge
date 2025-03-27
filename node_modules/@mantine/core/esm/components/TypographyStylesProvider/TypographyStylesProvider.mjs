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
import classes from './TypographyStylesProvider.module.css.mjs';

const defaultProps = {};
const TypographyStylesProvider = factory((_props, ref) => {
  const props = useProps("TypographyStylesProvider", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, ...others } = props;
  const getStyles = useStyles({
    name: "TypographyStylesProvider",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled
  });
  return /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root"), ...others });
});
TypographyStylesProvider.classes = classes;
TypographyStylesProvider.displayName = "@mantine/core/TypographyStylesProvider";

export { TypographyStylesProvider };
//# sourceMappingURL=TypographyStylesProvider.mjs.map
