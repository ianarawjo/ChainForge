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
require('../ModalBase/ModalBaseCloseButton.cjs');
require('../ModalBase/ModalBaseContent.cjs');
var ModalBaseHeader = require('../ModalBase/ModalBaseHeader.cjs');
require('../ModalBase/ModalBaseOverlay.cjs');
require('../ModalBase/ModalBaseTitle.cjs');
var Modal_context = require('./Modal.context.cjs');
var Modal_module = require('./Modal.module.css.cjs');

const defaultProps = {};
const ModalHeader = factory.factory((_props, ref) => {
  const props = useProps.useProps("ModalHeader", defaultProps, _props);
  const { classNames, className, style, styles, vars, ...others } = props;
  const ctx = Modal_context.useModalContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    ModalBaseHeader.ModalBaseHeader,
    {
      ref,
      ...ctx.getStyles("header", { classNames, style, styles, className }),
      ...others
    }
  );
});
ModalHeader.classes = Modal_module;
ModalHeader.displayName = "@mantine/core/ModalHeader";

exports.ModalHeader = ModalHeader;
//# sourceMappingURL=ModalHeader.cjs.map
