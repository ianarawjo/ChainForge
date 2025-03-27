'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
var useResolvedStylesApi = require('../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
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
var getOptionsLockup = require('../Combobox/get-options-lockup/get-options-lockup.cjs');
require('../Combobox/ComboboxChevron/ComboboxChevron.cjs');
var Combobox = require('../Combobox/Combobox.cjs');
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
var OptionsDropdown = require('../Combobox/OptionsDropdown/OptionsDropdown.cjs');
var useCombobox = require('../Combobox/use-combobox/use-combobox.cjs');
require('../Combobox/Combobox.context.cjs');
var InputBase = require('../InputBase/InputBase.cjs');

const defaultProps = {};
const Autocomplete = factory.factory((_props, ref) => {
  const props = useProps.useProps("Autocomplete", defaultProps, _props);
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
  const _id = hooks.useId(id);
  const parsedData = getParsedComboboxData.getParsedComboboxData(data);
  const optionsLockup = getOptionsLockup.getOptionsLockup(parsedData);
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: "",
    onChange
  });
  const combobox = useCombobox.useCombobox({
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
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    props,
    styles,
    classNames
  });
  React.useEffect(() => {
    if (selectFirstOptionOnChange) {
      combobox.selectFirstOption();
    }
  }, [selectFirstOptionOnChange, _value]);
  const clearButton = /* @__PURE__ */ jsxRuntime.jsx(
    Combobox.Combobox.ClearButton,
    {
      ...clearButtonProps,
      onClear: () => {
        handleValueChange("");
        onClear?.();
      }
    }
  );
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Combobox.Combobox,
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
        /* @__PURE__ */ jsxRuntime.jsx(Combobox.Combobox.Target, { autoComplete, children: /* @__PURE__ */ jsxRuntime.jsx(
          InputBase.InputBase,
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
        /* @__PURE__ */ jsxRuntime.jsx(
          OptionsDropdown.OptionsDropdown,
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
Autocomplete.classes = { ...InputBase.InputBase.classes, ...Combobox.Combobox.classes };
Autocomplete.displayName = "@mantine/core/Autocomplete";

exports.Autocomplete = Autocomplete;
//# sourceMappingURL=Autocomplete.cjs.map
