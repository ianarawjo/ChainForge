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
import { ModalBaseBody } from '../ModalBase/ModalBaseBody.mjs';
import '../ModalBase/ModalBaseCloseButton.mjs';
import '../ModalBase/ModalBaseContent.mjs';
import '../ModalBase/ModalBaseHeader.mjs';
import '../ModalBase/ModalBaseOverlay.mjs';
import '../ModalBase/ModalBaseTitle.mjs';
import { useModalContext } from './Modal.context.mjs';
import classes from './Modal.module.css.mjs';

const defaultProps = {};
const ModalBody = factory((_props, ref) => {
  const props = useProps("ModalBody", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = useModalContext();
  return /* @__PURE__ */ jsx(
    ModalBaseBody,
    {
      ref,
      ...ctx.getStyles("body", { classNames, style, styles, className }),
      ...others
    }
  );
});
ModalBody.classes = classes;
ModalBody.displayName = "@mantine/core/ModalBody";

export { ModalBody };
//# sourceMappingURL=ModalBody.mjs.map
