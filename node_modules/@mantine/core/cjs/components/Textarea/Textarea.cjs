'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var TextareaAutosize = require('react-textarea-autosize');
require('react');
require('@mantine/hooks');
var getEnv = require('../../core/utils/get-env/get-env.cjs');
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
var InputBase = require('../InputBase/InputBase.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var TextareaAutosize__default = /*#__PURE__*/_interopDefault(TextareaAutosize);

const defaultProps = {};
const Textarea = factory.factory((props, ref) => {
  const { autosize, maxRows, minRows, __staticSelector, resize, ...others } = useProps.useProps(
    "Textarea",
    defaultProps,
    props
  );
  const shouldAutosize = autosize && getEnv.getEnv() !== "test";
  const autosizeProps = shouldAutosize ? { maxRows, minRows } : {};
  return /* @__PURE__ */ jsxRuntime.jsx(
    InputBase.InputBase,
    {
      component: shouldAutosize ? TextareaAutosize__default.default : "textarea",
      ref,
      ...others,
      __staticSelector: __staticSelector || "Textarea",
      multiline: true,
      "data-no-overflow": autosize && maxRows === void 0 || void 0,
      __vars: { "--input-resize": resize },
      ...autosizeProps
    }
  );
});
Textarea.classes = InputBase.InputBase.classes;
Textarea.displayName = "@mantine/core/Textarea";

exports.Textarea = Textarea;
//# sourceMappingURL=Textarea.cjs.map
