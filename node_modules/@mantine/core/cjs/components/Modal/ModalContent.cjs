'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../ModalBase/ModalBase.cjs');
require('../ModalBase/ModalBaseBody.cjs');
require('../ModalBase/ModalBaseCloseButton.cjs');
var ModalBaseContent = require('../ModalBase/ModalBaseContent.cjs');
require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
require('../ModalBase/ModalBaseTitle.cjs');
var NativeScrollArea = require('../ModalBase/NativeScrollArea.cjs');
var Modal_context = require('./Modal.context.cjs');
var Modal_module = require('./Modal.module.css.cjs');

const defaultProps = {};
const ModalContent = factory.factory((_props, ref) => {
  const props = useProps.useProps("ModalContent", defaultProps, _props);
  const { classNames, className, style, styles, vars, children, __hidden, ...others } = props;
  const ctx = Modal_context.useModalContext();
  const Scroll = ctx.scrollAreaComponent || NativeScrollArea.NativeScrollArea;
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseContent.ModalBaseContent,
    {
      ...ctx.getStyles("content", { className, style, styles, classNames }),
      innerProps: ctx.getStyles("inner", { className, style, styles, classNames }),
      "data-full-screen": ctx.fullScreen || void 0,
      "data-modal-content": true,
      "data-hidden": __hidden || void 0,
      ref,
      ...others,
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Scroll,
        {
          style: {
            maxHeight: ctx.fullScreen ? "100dvh" : `calc(100dvh - (${rem.rem(ctx.yOffset)} * 2))`
          },
          children
        }
      )
    }
  );
});
ModalContent.classes = Modal_module;
ModalContent.displayName = "@mantine/core/ModalContent";

exports.ModalContent = ModalContent;
//# sourceMappingURL=ModalContent.cjs.map
