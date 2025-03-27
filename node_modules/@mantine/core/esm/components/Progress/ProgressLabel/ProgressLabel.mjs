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
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useProgressContext } from '../Progress.context.mjs';
import classes from '../Progress.module.css.mjs';

const defaultProps = {};
const ProgressLabel = factory((props, ref) => {
  const { classNames, className, style, styles, vars, ...others } = useProps(
    "ProgressLabel",
    defaultProps,
    props
  );
  const ctx = useProgressContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...ctx.getStyles("label", { className, style, classNames, styles }),
      ...others
    }
  );
});
ProgressLabel.classes = classes;
ProgressLabel.displayName = "@mantine/core/ProgressLabel";

export { ProgressLabel };
//# sourceMappingURL=ProgressLabel.mjs.map
