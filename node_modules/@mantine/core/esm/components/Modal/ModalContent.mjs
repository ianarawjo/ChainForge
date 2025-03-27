'use client';
import { jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
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
import { useModalContext } from './Modal.context.mjs';
import classes from './Modal.module.css.mjs';

const defaultProps = {};
const ModalContent = factory((_props, ref) => {
  const props = useProps("ModalContent", defaultProps, _props);
  const { classNames, className, style, styles, vars, children, __hidden, ...others } = props;
  const ctx = useModalContext();
  const Scroll = ctx.scrollAreaComponent || NativeScrollArea;
  return /* @__PURE__ */ jsx(
    ModalBaseContent,
    {
      ...ctx.getStyles("content", { className, style, styles, classNames }),
      innerProps: ctx.getStyles("inner", { className, style, styles, classNames }),
      "data-full-screen": ctx.fullScreen || void 0,
      "data-modal-content": true,
      "data-hidden": __hidden || void 0,
      ref,
      ...others,
      children: /* @__PURE__ */ jsx(
        Scroll,
        {
          style: {
            maxHeight: ctx.fullScreen ? "100dvh" : `calc(100dvh - (${rem(ctx.yOffset)} * 2))`
          },
          children
        }
      )
    }
  );
});
ModalContent.classes = classes;
ModalContent.displayName = "@mantine/core/ModalContent";

export { ModalContent };
//# sourceMappingURL=ModalContent.mjs.map
