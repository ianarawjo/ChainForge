'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
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
var ModalBaseCloseButton = require('../ModalBase/ModalBaseCloseButton.cjs');
require('../ModalBase/ModalBaseContent.cjs');
require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
require('../ModalBase/ModalBaseTitle.cjs');
var Modal_context = require('./Modal.context.cjs');
var Modal_module = require('./Modal.module.css.cjs');

const defaultProps = {};
const ModalCloseButton = factory.factory((_props, ref) => {
  const props = useProps.useProps("ModalCloseButton", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = Modal_context.useModalContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseCloseButton.ModalBaseCloseButton,
    {
      ref,
      ...ctx.getStyles("close", { classNames, style, styles, className }),
      ...others
    }
  );
});
ModalCloseButton.classes = Modal_module;
ModalCloseButton.displayName = "@mantine/core/ModalCloseButton";

exports.ModalCloseButton = ModalCloseButton;
//# sourceMappingURL=ModalCloseButton.cjs.map
