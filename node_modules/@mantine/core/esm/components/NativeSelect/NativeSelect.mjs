'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { getParsedComboboxData } from '../Combobox/get-parsed-combobox-data/get-parsed-combobox-data.mjs';
import { ComboboxChevron } from '../Combobox/ComboboxChevron/ComboboxChevron.mjs';
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
import '../Checkbox/Checkbox.mjs';
import '../Checkbox/CheckboxGroup/CheckboxGroup.mjs';
import '../Checkbox/CheckboxIndicator/CheckboxIndicator.mjs';
import '../Checkbox/CheckboxCard/CheckboxCard.mjs';
import '../Checkbox/CheckboxCard/CheckboxCard.context.mjs';
import '../Checkbox/CheckboxGroup.context.mjs';
import '../ScrollArea/ScrollArea.mjs';
import '../Combobox/Combobox.context.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';
import { NativeSelectOption } from './NativeSelectOption.mjs';

const defaultProps = {
  rightSectionPointerEvents: "none"
};
const NativeSelect = factory((props, ref) => {
  const { data, children, size, error, rightSection, unstyled, ...others } = useProps(
    "NativeSelect",
    defaultProps,
    props
  );
  const options = getParsedComboboxData(data).map((item, index) => /* @__PURE__ */ jsx(NativeSelectOption, { data: item }, index));
  return /* @__PURE__ */ jsx(
    InputBase,
    {
      component: "select",
      ref,
      ...others,
      __staticSelector: "NativeSelect",
      size,
      pointer: true,
      error,
      unstyled,
      rightSection: rightSection || /* @__PURE__ */ jsx(ComboboxChevron, { size, error, unstyled }),
      children: children || options
    }
  );
});
NativeSelect.classes = InputBase.classes;
NativeSelect.displayName = "@mantine/core/NativeSelect";

export { NativeSelect };
//# sourceMappingURL=NativeSelect.mjs.map
