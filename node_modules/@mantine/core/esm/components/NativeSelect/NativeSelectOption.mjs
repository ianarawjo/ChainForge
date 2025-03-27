'use client';
import { jsx } from 'react/jsx-runtime';

function isGroup(input) {
  return "group" in input;
}
function NativeSelectOption({ data }) {
  if (isGroup(data)) {
    const items = data.items.map((item) => /* @__PURE__ */ jsx(NativeSelectOption, { data: item }, item.value));
    return /* @__PURE__ */ jsx("optgroup", { label: data.group, children: items });
  }
  const { value, label, ...others } = data;
  return /* @__PURE__ */ jsx("option", { value: data.value, ...others, children: data.label }, data.value);
}
NativeSelectOption.displayName = "@mantine/core/NativeSelectOption";

export { NativeSelectOption };
//# sourceMappingURL=NativeSelectOption.mjs.map
