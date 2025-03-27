'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
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
const ComboboxGroup = factory((props, ref) => {
  const { classNames, className, style, styles, vars, children, label, ...others } = useProps(
    "ComboboxGroup",
    defaultProps,
    props
  );
  const ctx = useComboboxContext();
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ref,
      ...ctx.getStyles("group", { className, classNames, style, styles }),
      ...others,
      children: [
        label && /* @__PURE__ */ jsx("div", { ...ctx.getStyles("groupLabel", { classNames, styles }), children: label }),
        children
      ]
    }
  );
});
ComboboxGroup.classes = classes;
ComboboxGroup.displayName = "@mantine/core/ComboboxGroup";

export { ComboboxGroup };
//# sourceMappingURL=ComboboxGroup.mjs.map
