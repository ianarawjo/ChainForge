'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var cx = require('clsx');
require('@mantine/hooks');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var ModalBase_context = require('./ModalBase.context.cjs');
var useModalTitleId = require('./use-modal-title-id.cjs');
var ModalBase_module = require('./ModalBase.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const ModalBaseTitle = React.forwardRef(
  ({ className, ...others }, ref) => {
    const id = useModalTitleId.useModalTitle();
    const ctx = ModalBase_context.useModalBaseContext();
    return /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        component: "h2",
        ref,
        className: cx__default.default({ [ModalBase_module.title]: !ctx.unstyled }, className),
        ...others,
        id
      }
    );
  }
);
ModalBaseTitle.displayName = "@mantine/core/ModalBaseTitle";

exports.ModalBaseTitle = ModalBaseTitle;
//# sourceMappingURL=ModalBaseTitle.cjs.map
