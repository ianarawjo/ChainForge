'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var isElement = require('../../../core/utils/is-element/is-element.cjs');
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

const defaultProps = {
  refProp: "ref"
};
const ComboboxDropdownTarget = factory.factory((props, ref) => {
  const { children, refProp } = useProps.useProps("ComboboxDropdownTarget", defaultProps, props);
  Combobox_context.useComboboxContext();
  if (!isElement.isElement(children)) {
    throw new Error(
      "Combobox.DropdownTarget component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsx(Popover.Popover.Target, { ref, refProp, children });
});
ComboboxDropdownTarget.displayName = "@mantine/core/ComboboxDropdownTarget";

exports.ComboboxDropdownTarget = ComboboxDropdownTarget;
//# sourceMappingURL=ComboboxDropdownTarget.cjs.map
