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
const ComboboxGroup = factory.factory((props, ref) => {
  const { classNames, className, style, styles, vars, children, label, ...others } = useProps.useProps(
    "ComboboxGroup",
    defaultProps,
    props
  );
  const ctx = Combobox_context.useComboboxContext();
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ref,
      ...ctx.getStyles("group", { className, classNames, style, styles }),
      ...others,
      children: [
        label && /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("groupLabel", { classNames, styles }), children: label }),
        children
      ]
    }
  );
});
ComboboxGroup.classes = Combobox_module;
ComboboxGroup.displayName = "@mantine/core/ComboboxGroup";

exports.ComboboxGroup = ComboboxGroup;
//# sourceMappingURL=ComboboxGroup.cjs.map
