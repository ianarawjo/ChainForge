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
import '../ModalBase/ModalBaseOverlay.mjs';
import { ModalBaseTitle } from '../ModalBase/ModalBaseTitle.mjs';
import { useModalContext } from './Modal.context.mjs';
import classes from './Modal.module.css.mjs';

const defaultProps = {};
const ModalTitle = factory((_props, ref) => {
  const props = useProps("ModalTitle", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = useModalContext();
  return /* @__PURE__ */ jsx(
    ModalBaseTitle,
    {
      ref,
      ...ctx.getStyles("title", { classNames, style, styles, className }),
      ...others
    }
  );
});
ModalTitle.classes = classes;
ModalTitle.displayName = "@mantine/core/ModalTitle";

export { ModalTitle };
//# sourceMappingURL=ModalTitle.mjs.map
