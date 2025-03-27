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
var getParsedComboboxData = require('../Combobox/get-parsed-combobox-data/get-parsed-combobox-data.cjs');
var ComboboxChevron = require('../Combobox/ComboboxChevron/ComboboxChevron.cjs');
require('../Combobox/Combobox.cjs');
require('../Combobox/ComboboxDropdown/ComboboxDropdown.cjs');
require('../Combobox/ComboboxOptions/ComboboxOptions.cjs');
require('../Combobox/ComboboxOption/ComboboxOption.cjs');
require('../Combobox/ComboboxTarget/ComboboxTarget.cjs');
require('../Combobox/ComboboxSearch/ComboboxSearch.cjs');
require('../Combobox/ComboboxEmpty/ComboboxEmpty.cjs');
require('../Combobox/ComboboxFooter/ComboboxFooter.cjs');
require('../Combobox/ComboboxHeader/ComboboxHeader.cjs');
require('../Combobox/ComboboxEventsTarget/ComboboxEventsTarget.cjs');
require('../Combobox/ComboboxDropdownTarget/ComboboxDropdownTarget.cjs');
require('../Combobox/ComboboxGroup/ComboboxGroup.cjs');
require('../Combobox/ComboboxClearButton/ComboboxClearButton.cjs');
require('../Combobox/ComboboxHiddenInput/ComboboxHiddenInput.cjs');
require('../Checkbox/Checkbox.cjs');
require('../Checkbox/CheckboxGroup/CheckboxGroup.cjs');
require('../Checkbox/CheckboxIndicator/CheckboxIndicator.cjs');
require('../Checkbox/CheckboxCard/CheckboxCard.cjs');
require('../Checkbox/CheckboxCard/CheckboxCard.context.cjs');
require('../Checkbox/CheckboxGroup.context.cjs');
require('../ScrollArea/ScrollArea.cjs');
require('../Combobox/Combobox.context.cjs');
var InputBase = require('../InputBase/InputBase.cjs');
var NativeSelectOption = require('./NativeSelectOption.cjs');

const defaultProps = {
  rightSectionPointerEvents: "none"
};
const NativeSelect = factory.factory((props, ref) => {
  const { data, children, size, error, rightSection, unstyled, ...others } = useProps.useProps(
    "NativeSelect",
    defaultProps,
    props
  );
  const options = getParsedComboboxData.getParsedComboboxData(data).map((item, index) => /* @__PURE__ */ jsxRuntime.jsx(NativeSelectOption.NativeSelectOption, { data: item }, index));
  return /* @__PURE__ */ jsxRuntime.jsx(
    InputBase.InputBase,
    {
      component: "select",
      ref,
      ...others,
      __staticSelector: "NativeSelect",
      size,
      pointer: true,
      error,
      unstyled,
      rightSection: rightSection || /* @__PURE__ */ jsxRuntime.jsx(ComboboxChevron.ComboboxChevron, { size, error, unstyled }),
      children: children || options
    }
  );
});
NativeSelect.classes = InputBase.InputBase.classes;
NativeSelect.displayName = "@mantine/core/NativeSelect";

exports.NativeSelect = NativeSelect;
//# sourceMappingURL=NativeSelect.cjs.map
