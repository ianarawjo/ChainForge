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
import { ModalBaseHeader } from '../ModalBase/ModalBaseHeader.mjs';
import '../ModalBase/ModalBaseOverlay.mjs';
import '../ModalBase/ModalBaseTitle.mjs';
import { useModalContext } from './Modal.context.mjs';
import classes from './Modal.module.css.mjs';

const defaultProps = {};
const ModalHeader = factory((_props, ref) => {
  const props = useProps("ModalHeader", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = useModalContext();
  return /* @__PURE__ */ jsx(
    ModalBaseHeader,
    {
      ref,
      ...ctx.getStyles("header", { classNames, style, styles, className }),
      ...others
    }
  );
});
ModalHeader.classes = classes;
ModalHeader.displayName = "@mantine/core/ModalHeader";

export { ModalHeader };
//# sourceMappingURL=ModalHeader.mjs.map
