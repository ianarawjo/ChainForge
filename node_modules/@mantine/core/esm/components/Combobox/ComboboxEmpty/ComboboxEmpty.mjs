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
import { useComboboxContext } from '../Combobox.context.mjs';
import classes from '../Combobox.module.css.mjs';

const defaultProps = {};
const ComboboxEmpty = factory((props, ref) => {
  const { classNames, className, style, styles, vars, ...others } = useProps(
    "ComboboxEmpty",
    defaultProps,
    props
  );
  const ctx = useComboboxContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...ctx.getStyles("empty", { className, classNames, styles, style }),
      ...others
    }
  );
});
ComboboxEmpty.classes = classes;
ComboboxEmpty.displayName = "@mantine/core/ComboboxEmpty";

export { ComboboxEmpty };
//# sourceMappingURL=ComboboxEmpty.mjs.map
