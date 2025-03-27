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
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../ModalBase/ModalBase.mjs';
import '../ModalBase/ModalBaseBody.mjs';
import '../ModalBase/ModalBaseCloseButton.mjs';
import { ModalBaseContent } from '../ModalBase/ModalBaseContent.mjs';
import '../ModalBase/ModalBaseHeader.mjs';
import '../ModalBase/ModalBaseOverlay.mjs';
import '../ModalBase/ModalBaseTitle.mjs';
import { NativeScrollArea } from '../ModalBase/NativeScrollArea.mjs';
import { useDrawerContext } from './Drawer.context.mjs';
import classes from './Drawer.module.css.mjs';

const defaultProps = {};
const DrawerContent = factory((_props, ref) => {
  const props = useProps("DrawerContent", defaultProps, _props);
  const { classNames, className, style, styles, vars, children, radius, __hidden, ...others } = props;
  const ctx = useDrawerContext();
  const Scroll = ctx.scrollAreaComponent || NativeScrollArea;
  return /* @__PURE__ */ jsx(
    ModalBaseContent,
    {
      ...ctx.getStyles("content", { className, style, styles, classNames }),
      innerProps: ctx.getStyles("inner", { className, style, styles, classNames }),
      ref,
      ...others,
      radius: radius || ctx.radius || 0,
      "data-hidden": __hidden || void 0,
      children: /* @__PURE__ */ jsx(Scroll, { style: { height: "calc(100vh - var(--drawer-offset) * 2)" }, children })
    }
  );
});
DrawerContent.classes = classes;
DrawerContent.displayName = "@mantine/core/DrawerContent";

export { DrawerContent };
//# sourceMappingURL=DrawerContent.mjs.map
