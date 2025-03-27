'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
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
import classes from '../Input.module.css.mjs';

const defaultProps = {};
const InputPlaceholder = factory((_props, ref) => {
  const props = useProps("InputPlaceholder", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    __staticSelector,
    variant,
    error,
    mod,
    ...others
  } = useProps("InputPlaceholder", defaultProps, props);
  const getStyles = useStyles({
    name: ["InputPlaceholder", __staticSelector],
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "placeholder"
  });
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...getStyles("placeholder"),
      mod: [{ error: !!error }, mod],
      component: "span",
      variant,
      ref,
      ...others
    }
  );
});
InputPlaceholder.classes = classes;
InputPlaceholder.displayName = "@mantine/core/InputPlaceholder";

export { InputPlaceholder };
//# sourceMappingURL=InputPlaceholder.mjs.map
