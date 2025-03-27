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
import { ModalBaseCloseButton } from '../ModalBase/ModalBaseCloseButton.mjs';
import '../ModalBase/ModalBaseContent.mjs';
import '../ModalBase/ModalBaseHeader.mjs';
import '../ModalBase/ModalBaseOverlay.mjs';
import '../ModalBase/ModalBaseTitle.mjs';
import { useDrawerContext } from './Drawer.context.mjs';
import classes from './Drawer.module.css.mjs';

const defaultProps = {};
const DrawerCloseButton = factory((_props, ref) => {
  const props = useProps("DrawerCloseButton", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = useDrawerContext();
  return /* @__PURE__ */ jsx(
    ModalBaseCloseButton,
    {
      ref,
      ...ctx.getStyles("close", { classNames, style, styles, className }),
      ...others
    }
  );
});
DrawerCloseButton.classes = classes;
DrawerCloseButton.displayName = "@mantine/core/DrawerCloseButton";

export { DrawerCloseButton };
//# sourceMappingURL=DrawerCloseButton.mjs.map
