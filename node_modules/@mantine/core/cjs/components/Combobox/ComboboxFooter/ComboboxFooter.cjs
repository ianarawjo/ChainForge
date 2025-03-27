'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Combobox_context = require('../Combobox.context.cjs');
var Combobox_module = require('../Combobox.module.css.cjs');

const defaultProps = {};
const ComboboxFooter = factory.factory((props, ref) => {
  const { classNames, className, style, styles, vars, ...others } = useProps.useProps(
    "ComboboxFooter",
    defaultProps,
    props
  );
  const ctx = Combobox_context.useComboboxContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      ...ctx.getStyles("footer", { className, classNames, style, styles }),
      ...others,
      onMouseDown: (event) => {
        event.preventDefault();
      }
    }
  );
});
ComboboxFooter.classes = Combobox_module;
ComboboxFooter.displayName = "@mantine/core/ComboboxFooter";

exports.ComboboxFooter = ComboboxFooter;
//# sourceMappingURL=ComboboxFooter.cjs.map
