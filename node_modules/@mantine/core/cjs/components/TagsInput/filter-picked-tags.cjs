'use client';
'use strict';

require('../Combobox/ComboboxChevron/ComboboxChevron.cjs');
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
require('react/jsx-runtime');
require('clsx');
require('../Checkbox/Checkbox.cjs');
require('../Checkbox/CheckboxGroup/CheckboxGroup.cjs');
require('react');
require('@mantine/hooks');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../Checkbox/CheckboxIndicator/CheckboxIndicator.cjs');
require('../Checkbox/CheckboxCard/CheckboxCard.cjs');
require('../Checkbox/CheckboxCard/CheckboxCard.context.cjs');
require('../Checkbox/CheckboxGroup.context.cjs');
require('../ScrollArea/ScrollArea.cjs');
var isOptionsGroup = require('../Combobox/OptionsDropdown/is-options-group.cjs');
require('../Combobox/Combobox.context.cjs');

function filterPickedTags({ data, value }) {
  const normalizedValue = value.map((item) => item.trim().toLowerCase());
  const filtered = data.reduce((acc, item) => {
    if (isOptionsGroup.isOptionsGroup(item)) {
      acc.push({
        group: item.group,
        items: item.items.filter(
          (option) => normalizedValue.indexOf(option.label.toLowerCase().trim()) === -1
        )
      });
    } else if (normalizedValue.indexOf(item.label.toLowerCase().trim()) === -1) {
      acc.push(item);
    }
    return acc;
  }, []);
  return filtered;
}

exports.filterPickedTags = filterPickedTags;
//# sourceMappingURL=filter-picked-tags.cjs.map
