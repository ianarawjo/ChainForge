'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var cx = require('clsx');
require('../CloseButton/CloseIcon.cjs');
var CloseButton = require('../CloseButton/CloseButton.cjs');
var ModalBase_context = require('./ModalBase.context.cjs');
var ModalBase_module = require('./ModalBase.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const ModalBaseCloseButton = React.forwardRef(
  ({ className, onClick, ...others }, ref) => {
    const ctx = ModalBase_context.useModalBaseContext();
    return /* @__PURE__ */ jsxRuntime.jsx(
      CloseButton.CloseButton,
      {
        ref,
        ...others,
        onClick: (event) => {
          ctx.onClose();
          onClick?.(event);
        },
        className: cx__default.default({ [ModalBase_module.close]: !ctx.unstyled }, className),
        unstyled: ctx.unstyled
      }
    );
  }
);
ModalBaseCloseButton.displayName = "@mantine/core/ModalBaseCloseButton";

exports.ModalBaseCloseButton = ModalBaseCloseButton;
//# sourceMappingURL=ModalBaseCloseButton.cjs.map
