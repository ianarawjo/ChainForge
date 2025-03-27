'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');

function ComboboxHiddenInput({
  value,
  valuesDivider = ",",
  ...others
}) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "input",
    {
      type: "hidden",
      value: Array.isArray(value) ? value.join(valuesDivider) : value || "",
      ...others
    }
  );
}
ComboboxHiddenInput.displayName = "@mantine/core/ComboboxHiddenInput";

exports.ComboboxHiddenInput = ComboboxHiddenInput;
//# sourceMappingURL=ComboboxHiddenInput.cjs.map
