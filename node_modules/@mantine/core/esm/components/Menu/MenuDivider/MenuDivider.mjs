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
import { useMenuContext } from '../Menu.context.mjs';
import classes from '../Menu.module.css.mjs';

const defaultProps = {};
const MenuDivider = factory((props, ref) => {
  const { classNames, className, style, styles, vars, ...others } = useProps(
    "MenuDivider",
    defaultProps,
    props
  );
  const ctx = useMenuContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...ctx.getStyles("divider", { className, style, styles, classNames }),
      ...others
    }
  );
});
MenuDivider.classes = classes;
MenuDivider.displayName = "@mantine/core/MenuDivider";

export { MenuDivider };
//# sourceMappingURL=MenuDivider.mjs.map
