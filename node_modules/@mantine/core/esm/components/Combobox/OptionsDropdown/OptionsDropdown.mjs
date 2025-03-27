'use client';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import cx from 'clsx';
import '../../Checkbox/Checkbox.mjs';
import '../../Checkbox/CheckboxGroup/CheckboxGroup.mjs';
import { CheckIcon } from '../../Checkbox/CheckIcon.mjs';
import '../../Checkbox/CheckboxIndicator/CheckboxIndicator.mjs';
import '../../Checkbox/CheckboxCard/CheckboxCard.mjs';
import '../../Checkbox/CheckboxCard/CheckboxCard.context.mjs';
import '../../Checkbox/CheckboxGroup.context.mjs';
import { ScrollArea } from '../../ScrollArea/ScrollArea.mjs';
import { Combobox } from '../Combobox.mjs';
import { defaultOptionsFilter } from './default-options-filter.mjs';
import { isEmptyComboboxData } from './is-empty-combobox-data.mjs';
import { isOptionsGroup } from './is-options-group.mjs';
import { validateOptions } from './validate-options.mjs';
import classes from '../Combobox.module.css.mjs';

function isValueChecked(value, optionValue) {
  return Array.isArray(value) ? value.includes(optionValue) : value === optionValue;
}
function Option({
  data,
  withCheckIcon,
  value,
  checkIconPosition,
  unstyled,
  renderOption
}) {
  if (!isOptionsGroup(data)) {
    const checked = isValueChecked(value, data.value);
    const check = withCheckIcon && checked && /* @__PURE__ */ jsx(CheckIcon, { className: classes.optionsDropdownCheckIcon });
    const defaultContent = /* @__PURE__ */ jsxs(Fragment, { children: [
      checkIconPosition === "left" && check,
      /* @__PURE__ */ jsx("span", { children: data.label }),
      checkIconPosition === "right" && check
    ] });
    return /* @__PURE__ */ jsx(
      Combobox.Option,
      {
        value: data.value,
        disabled: data.disabled,
        className: cx({ [classes.optionsDropdownOption]: !unstyled }),
        "data-reverse": checkIconPosition === "right" || void 0,
        "data-checked": checked || void 0,
        "aria-selected": checked,
        active: checked,
        children: typeof renderOption === "function" ? renderOption({ option: data, checked }) : defaultContent
      }
    );
  }
  const options = data.items.map((item) => /* @__PURE__ */ jsx(
    Option,
    {
      data: item,
      value,
      unstyled,
      withCheckIcon,
      checkIconPosition,
      renderOption
    },
    item.value
  ));
  return /* @__PURE__ */ jsx(Combobox.Group, { label: data.group, children: options });
}
function OptionsDropdown({
  data,
  hidden,
  hiddenWhenEmpty,
  filter,
  search,
  limit,
  maxDropdownHeight,
  withScrollArea = true,
  filterOptions = true,
  withCheckIcon = false,
  value,
  checkIconPosition,
  nothingFoundMessage,
  unstyled,
  labelId,
  renderOption,
  scrollAreaProps,
  "aria-label": ariaLabel
}) {
  validateOptions(data);
  const shouldFilter = typeof search === "string";
  const filteredData = shouldFilter ? (filter || defaultOptionsFilter)({
    options: data,
    search: filterOptions ? search : "",
    limit: limit ?? Infinity
  }) : data;
  const isEmpty = isEmptyComboboxData(filteredData);
  const options = filteredData.map((item) => /* @__PURE__ */ jsx(
    Option,
    {
      data: item,
      withCheckIcon,
      value,
      checkIconPosition,
      unstyled,
      renderOption
    },
    isOptionsGroup(item) ? item.group : item.value
  ));
  return /* @__PURE__ */ jsx(Combobox.Dropdown, { hidden: hidden || hiddenWhenEmpty && isEmpty, "data-composed": true, children: /* @__PURE__ */ jsxs(Combobox.Options, { labelledBy: labelId, "aria-label": ariaLabel, children: [
    withScrollArea ? /* @__PURE__ */ jsx(
      ScrollArea.Autosize,
      {
        mah: maxDropdownHeight ?? 220,
        type: "scroll",
        scrollbarSize: "var(--combobox-padding)",
        offsetScrollbars: "y",
        ...scrollAreaProps,
        children: options
      }
    ) : options,
    isEmpty && nothingFoundMessage && /* @__PURE__ */ jsx(Combobox.Empty, { children: nothingFoundMessage })
  ] }) });
}

export { OptionsDropdown };
//# sourceMappingURL=OptionsDropdown.mjs.map
