'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var cx = require('clsx');
require('react');
require('@mantine/hooks');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Text = require('../Text/Text.cjs');
var Anchor_module = require('./Anchor.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const defaultProps = {
  underline: "hover"
};
const Anchor = polymorphicFactory.polymorphicFactory((props, ref) => {
  const { underline, className, unstyled, mod, ...others } = useProps.useProps(
    "Anchor",
    defaultProps,
    props
  );
  return /* @__PURE__ */ jsxRuntime.jsx(
    Text.Text,
    {
      component: "a",
      ref,
      className: cx__default.default({ [Anchor_module.root]: !unstyled }, className),
      ...others,
      mod: [{ underline }, mod],
      __staticSelector: "Anchor",
      unstyled
    }
  );
});
Anchor.classes = Anchor_module;
Anchor.displayName = "@mantine/core/Anchor";

exports.Anchor = Anchor;
//# sourceMappingURL=Anchor.cjs.map
