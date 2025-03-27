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
import { useAppShellContext } from '../AppShell.context.mjs';
import classes from '../AppShell.module.css.mjs';

const defaultProps = {};
const AppShellMain = factory((_props, ref) => {
  const props = useProps("AppShellMain", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = useAppShellContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      component: "main",
      ref,
      ...ctx.getStyles("main", { className, style, classNames, styles }),
      ...others
    }
  );
});
AppShellMain.classes = classes;
AppShellMain.displayName = "@mantine/core/AppShellMain";

export { AppShellMain };
//# sourceMappingURL=AppShellMain.mjs.map
