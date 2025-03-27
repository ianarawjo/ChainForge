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
import '../ModalBase/ModalBaseContent.mjs';
import '../ModalBase/ModalBaseHeader.mjs';
import { ModalBaseOverlay } from '../ModalBase/ModalBaseOverlay.mjs';
import '../ModalBase/ModalBaseTitle.mjs';
import { useModalContext } from './Modal.context.mjs';
import classes from './Modal.module.css.mjs';

const defaultProps = {};
const ModalOverlay = factory((_props, ref) => {
  const props = useProps("ModalOverlay", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = useModalContext();
  return /* @__PURE__ */ jsx(
    ModalBaseOverlay,
    {
      ref,
      ...ctx.getStyles("overlay", { classNames, style, styles, className }),
      ...others
    }
  );
});
ModalOverlay.classes = classes;
ModalOverlay.displayName = "@mantine/core/ModalOverlay";

export { ModalOverlay };
//# sourceMappingURL=ModalOverlay.mjs.map
