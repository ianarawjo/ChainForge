'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useEffect } from 'react';
import { useId, useUncontrolled } from '@mantine/hooks';
import 'clsx';
import { useResolvedStylesApi } from '../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
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
import { getOptionsLockup } from '../Combobox/get-options-lockup/get-options-lockup.mjs';
import '../Combobox/ComboboxChevron/ComboboxChevron.mjs';
import { Combobox } from '../Combobox/Combobox.mjs';
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
import { OptionsDropdown } from '../Combobox/OptionsDropdown/OptionsDropdown.mjs';
import { useCombobox } from '../Combobox/use-combobox/use-combobox.mjs';
import '../Combobox/Combobox.context.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';

const defaultProps = {};
const Autocomplete = factory((_props, ref) => {
  const props = useProps("Autocomplete", defaultProps, _props);
  const {
    classNames,
    styles,
    unstyled,
    vars,
    dropdownOpened,
    defaultDropdownOpened,
    onDropdownClose,
    onDropdownOpen,
    onFocus,
    onBlur,
    onClick,
    onChange,
    data,
    value,
    defaultValue,
    selectFirstOptionOnChange,
    onOptionSubmit,
    comboboxProps,
    readOnly,
    disabled,
    filter,
    limit,
    withScrollArea,
    maxDropdownHeight,
    size,
    id,
    renderOption,
    autoComplete,
    scrollAreaProps,
    onClear,
    clearButtonProps,
    error,
    clearable,
    rightSection,
    ...others
  } = props;
  const _id = useId(id);
  const parsedData = getParsedComboboxData(data);
  const optionsLockup = getOptionsLockup(parsedData);
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const combobox = useCombobox({
    opened: dropdownOpened,
    defaultOpened: defaultDropdownOpened,
    onDropdownOpen,
    onDropdownClose: () => {
      onDropdownClose?.();
      combobox.resetSelectedOption();
    }
  });
  const handleValueChange = (value2) => {
    setValue(value2);
    combobox.resetSelectedOption();
  };
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    props,
    styles,
    classNames
  });
  useEffect(() => {
    if (selectFirstOptionOnChange) {
      combobox.selectFirstOption();
    }
  }, [selectFirstOptionOnChange, _value]);
  const clearButton = /* @__PURE__ */ jsx(
    Combobox.ClearButton,
    {
      ...clearButtonProps,
      onClear: () => {
        handleValueChange("");
        onClear?.();
      }
    }
  );
  return /* @__PURE__ */ jsxs(
    Combobox,
    {
      store: combobox,
      __staticSelector: "Autocomplete",
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      unstyled,
      readOnly,
      onOptionSubmit: (val) => {
        onOptionSubmit?.(val);
        handleValueChange(optionsLockup[val].label);
        combobox.closeDropdown();
      },
      size,
      ...comboboxProps,
      children: [
        /* @__PURE__ */ jsx(Combobox.Target, { autoComplete, children: /* @__PURE__ */ jsx(
          InputBase,
          {
            ref,
            ...others,
            size,
            __staticSelector: "Autocomplete",
            __clearSection: clearButton,
            __clearable: clearable && !!_value && !disabled && !readOnly,
            rightSection,
            disabled,
            readOnly,
            value: _value,
            error,
            onChange: (event) => {
              handleValueChange(event.currentTarget.value);
              combobox.openDropdown();
              selectFirstOptionOnChange && combobox.selectFirstOption();
            },
            onFocus: (event) => {
              combobox.openDropdown();
              onFocus?.(event);
            },
            onBlur: (event) => {
              combobox.closeDropdown();
              onBlur?.(event);
            },
            onClick: (event) => {
              combobox.openDropdown();
              onClick?.(event);
            },
            classNames: resolvedClassNames,
            styles: resolvedStyles,
            unstyled,
            id: _id
          }
        ) }),
        /* @__PURE__ */ jsx(
          OptionsDropdown,
          {
            data: parsedData,
            hidden: readOnly || disabled,
            filter,
            search: _value,
            limit,
            hiddenWhenEmpty: true,
            withScrollArea,
            maxDropdownHeight,
            unstyled,
            labelId: others.label ? `${_id}-label` : void 0,
            "aria-label": others.label ? void 0 : others["aria-label"],
            renderOption,
            scrollAreaProps
          }
        )
      ]
    }
  );
});
Autocomplete.classes = { ...InputBase.classes, ...Combobox.classes };
Autocomplete.displayName = "@mantine/core/Autocomplete";

export { Autocomplete };
//# sourceMappingURL=Autocomplete.mjs.map
