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
import { polymorphicFactory } from '../../../core/factory/polymorphic-factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useAppShellContext } from '../AppShell.context.mjs';
import classes from '../AppShell.module.css.mjs';

const defaultProps = {};
const AppShellSection = polymorphicFactory((_props, ref) => {
  const props = useProps("AppShellSection", defaultProps, _props);
  const { classNames, className, style, styles, vars, grow, mod, ...others } = props;
  const ctx = useAppShellContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      mod: [{ grow }, mod],
      ...ctx.getStyles("section", { className, style, classNames, styles }),
      ...others
    }
  );
});
AppShellSection.classes = classes;
AppShellSection.displayName = "@mantine/core/AppShellSection";

export { AppShellSection };
//# sourceMappingURL=AppShellSection.mjs.map
