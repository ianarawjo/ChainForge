'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
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
import { AppShellProvider } from './AppShell.context.mjs';
import { AppShellAside } from './AppShellAside/AppShellAside.mjs';
import { AppShellFooter } from './AppShellFooter/AppShellFooter.mjs';
import { AppShellHeader } from './AppShellHeader/AppShellHeader.mjs';
import { AppShellMain } from './AppShellMain/AppShellMain.mjs';
import { AppShellMediaStyles } from './AppShellMediaStyles/AppShellMediaStyles.mjs';
import { AppShellNavbar } from './AppShellNavbar/AppShellNavbar.mjs';
import { AppShellSection } from './AppShellSection/AppShellSection.mjs';
import { useResizing } from './use-resizing/use-resizing.mjs';
import classes from './AppShell.module.css.mjs';

const defaultProps = {
  withBorder: true,
  padding: 0,
  transitionDuration: 200,
  transitionTimingFunction: "ease",
  zIndex: getDefaultZIndex("app")
};
const varsResolver = createVarsResolver(
  (_, { transitionDuration, transitionTimingFunction }) => ({
    root: {
      "--app-shell-transition-duration": `${transitionDuration}ms`,
      "--app-shell-transition-timing-function": transitionTimingFunction
    }
  })
);
const AppShell = factory((_props, ref) => {
  const props = useProps("AppShell", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    navbar,
    withBorder,
    padding,
    transitionDuration,
    transitionTimingFunction,
    header,
    zIndex,
    layout,
    disabled,
    aside,
    footer,
    offsetScrollbars = layout !== "alt",
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "AppShell",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const resizing = useResizing({ disabled, transitionDuration });
  return /* @__PURE__ */ jsxs(AppShellProvider, { value: { getStyles, withBorder, zIndex, disabled, offsetScrollbars }, children: [
    /* @__PURE__ */ jsx(
      AppShellMediaStyles,
      {
        navbar,
        header,
        aside,
        footer,
        padding
      }
    ),
    /* @__PURE__ */ jsx(
      Box,
      {
        ref,
        ...getStyles("root"),
        mod: [{ resizing, layout, disabled }, mod],
        ...others
      }
    )
  ] });
});
AppShell.classes = classes;
AppShell.displayName = "@mantine/core/AppShell";
AppShell.Navbar = AppShellNavbar;
AppShell.Header = AppShellHeader;
AppShell.Main = AppShellMain;
AppShell.Aside = AppShellAside;
AppShell.Footer = AppShellFooter;
AppShell.Section = AppShellSection;

export { AppShell };
//# sourceMappingURL=AppShell.mjs.map
