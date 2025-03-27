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
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Popover = require('../../Popover/Popover.cjs');
require('../../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../../Popover/PopoverTarget/PopoverTarget.cjs');
var Combobox_context = require('../Combobox.context.cjs');
var Combobox_module = require('../Combobox.module.css.cjs');

const defaultProps = {};
const ComboboxDropdown = factory.factory((props, ref) => {
  const { classNames, styles, className, style, hidden, ...others } = useProps.useProps(
    "ComboboxDropdown",
    defaultProps,
    props
  );
  const ctx = Combobox_context.useComboboxContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Popover.Popover.Dropdown,
    {
      ...others,
      ref,
      role: "presentation",
      "data-hidden": hidden || void 0,
      ...ctx.getStyles("dropdown", { className, style, classNames, styles })
    }
  );
});
ComboboxDropdown.classes = Combobox_module;
ComboboxDropdown.displayName = "@mantine/core/ComboboxDropdown";

exports.ComboboxDropdown = ComboboxDropdown;
//# sourceMappingURL=ComboboxDropdown.cjs.map
