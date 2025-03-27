'use client';
import '../Combobox/ComboboxChevron/ComboboxChevron.mjs';
import '../Combobox/Combobox.mjs';
import '../Combobox/ComboboxDropdown/ComboboxDropdown.mjs';
import '../Combobox/ComboboxOptions/ComboboxOptions.mjs';
import '../Combobox/ComboboxOption/ComboboxOption.mjs';
import '../Combobox/ComboboxTarget/ComboboxTarget.mjs';
import '../Combobox/ComboboxSearch/ComboboxSearch.mjs';
import '../Combobox/ComboboxEmpty/ComboboxEmpty.mjs';
import '../Combobox/ComboboxFooter/ComboboxFooter.mjs';
import '../Combobox/ComboboxHeader/ComboboxHeader.mjs';
import '../Combobox/ComboboxEventsTarget/ComboboxEventsTarget.mjs';
import '../Combobox/ComboboxDropdownTarget/ComboboxDropdownTarget.mjs';
import '../Combobox/ComboboxGroup/ComboboxGroup.mjs';
import '../Combobox/ComboboxClearButton/ComboboxClearButton.mjs';
import '../Combobox/ComboboxHiddenInput/ComboboxHiddenInput.mjs';
import 'react/jsx-runtime';
import 'clsx';
import '../Checkbox/Checkbox.mjs';
import '../Checkbox/CheckboxGroup/CheckboxGroup.mjs';
import 'react';
import '@mantine/hooks';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../Checkbox/CheckboxIndicator/CheckboxIndicator.mjs';
import '../Checkbox/CheckboxCard/CheckboxCard.mjs';
import '../Checkbox/CheckboxCard/CheckboxCard.context.mjs';
import '../Checkbox/CheckboxGroup.context.mjs';
import '../ScrollArea/ScrollArea.mjs';
import { isOptionsGroup } from '../Combobox/OptionsDropdown/is-options-group.mjs';
import '../Combobox/Combobox.context.mjs';

function filterPickedValues({ data, value }) {
  const normalizedValue = value.map((item) => item.trim().toLowerCase());
  const filtered = data.reduce((acc, item) => {
    if (isOptionsGroup(item)) {
      acc.push({
        group: item.group,
        items: item.items.filter(
          (option) => normalizedValue.indexOf(option.value.toLowerCase().trim()) === -1
        )
      });
    } else if (normalizedValue.indexOf(item.value.toLowerCase().trim()) === -1) {
      acc.push(item);
    }
    return acc;
  }, []);
  return filtered;
}

export { filterPickedValues };
//# sourceMappingURL=filter-picked-values.mjs.map
