'use client';
import { jsx } from 'react/jsx-runtime';

function ComboboxHiddenInput({
  value,
  valuesDivider = ",",
  ...others
}) {
  return /* @__PURE__ */ jsx(
    "input",
    {
      type: "hidden",
      value: Array.isArray(value) ? value.join(valuesDivider) : value || "",
      ...others
    }
  );
}
ComboboxHiddenInput.displayName = "@mantine/core/ComboboxHiddenInput";

export { ComboboxHiddenInput };
//# sourceMappingURL=ComboboxHiddenInput.mjs.map
