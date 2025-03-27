'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var cx = require('clsx');
require('../../Checkbox/Checkbox.cjs');
require('../../Checkbox/CheckboxGroup/CheckboxGroup.cjs');
var CheckIcon = require('../../Checkbox/CheckIcon.cjs');
require('../../Checkbox/CheckboxIndicator/CheckboxIndicator.cjs');
require('../../Checkbox/CheckboxCard/CheckboxCard.cjs');
require('../../Checkbox/CheckboxCard/CheckboxCard.context.cjs');
require('../../Checkbox/CheckboxGroup.context.cjs');
var ScrollArea = require('../../ScrollArea/ScrollArea.cjs');
var Combobox = require('../Combobox.cjs');
var defaultOptionsFilter = require('./default-options-filter.cjs');
var isEmptyComboboxData = require('./is-empty-combobox-data.cjs');
var isOptionsGroup = require('./is-options-group.cjs');
var validateOptions = require('./validate-options.cjs');
var Combobox_module = require('../Combobox.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

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
  if (!isOptionsGroup.isOptionsGroup(data)) {
    const checked = isValueChecked(value, data.value);
    const check = withCheckIcon && checked && /* @__PURE__ */ jsxRuntime.jsx(CheckIcon.CheckIcon, { className: Combobox_module.optionsDropdownCheckIcon });
    const defaultContent = /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      checkIconPosition === "left" && check,
      /* @__PURE__ */ jsxRuntime.jsx("span", { children: data.label }),
      checkIconPosition === "right" && check
    ] });
    return /* @__PURE__ */ jsxRuntime.jsx(
      Combobox.Combobox.Option,
      {
        value: data.value,
        disabled: data.disabled,
        className: cx__default.default({ [Combobox_module.optionsDropdownOption]: !unstyled }),
        "data-reverse": checkIconPosition === "right" || void 0,
        "data-checked": checked || void 0,
        "aria-selected": checked,
        active: checked,
        children: typeof renderOption === "function" ? renderOption({ option: data, checked }) : defaultContent
      }
    );
  }
  const options = data.items.map((item) => /* @__PURE__ */ jsxRuntime.jsx(
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
  return /* @__PURE__ */ jsxRuntime.jsx(Combobox.Combobox.Group, { label: data.group, children: options });
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
  validateOptions.validateOptions(data);
  const shouldFilter = typeof search === "string";
  const filteredData = shouldFilter ? (filter || defaultOptionsFilter.defaultOptionsFilter)({
    options: data,
    search: filterOptions ? search : "",
    limit: limit ?? Infinity
  }) : data;
  const isEmpty = isEmptyComboboxData.isEmptyComboboxData(filteredData);
  const options = filteredData.map((item) => /* @__PURE__ */ jsxRuntime.jsx(
    Option,
    {
      data: item,
      withCheckIcon,
      value,
      checkIconPosition,
      unstyled,
      renderOption
    },
    isOptionsGroup.isOptionsGroup(item) ? item.group : item.value
  ));
  return /* @__PURE__ */ jsxRuntime.jsx(Combobox.Combobox.Dropdown, { hidden: hidden || hiddenWhenEmpty && isEmpty, "data-composed": true, children: /* @__PURE__ */ jsxRuntime.jsxs(Combobox.Combobox.Options, { labelledBy: labelId, "aria-label": ariaLabel, children: [
    withScrollArea ? /* @__PURE__ */ jsxRuntime.jsx(
      ScrollArea.ScrollArea.Autosize,
      {
        mah: maxDropdownHeight ?? 220,
        type: "scroll",
        scrollbarSize: "var(--combobox-padding)",
        offsetScrollbars: "y",
        ...scrollAreaProps,
        children: options
      }
    ) : options,
    isEmpty && nothingFoundMessage && /* @__PURE__ */ jsxRuntime.jsx(Combobox.Combobox.Empty, { children: nothingFoundMessage })
  ] }) });
}

exports.OptionsDropdown = OptionsDropdown;
//# sourceMappingURL=OptionsDropdown.cjs.map
