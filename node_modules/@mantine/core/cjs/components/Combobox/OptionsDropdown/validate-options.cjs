'use client';
'use strict';

var isOptionsGroup = require('./is-options-group.cjs');

function validateOptions(options, valuesSet = /* @__PURE__ */ new Set()) {
  if (!Array.isArray(options)) {
    return;
  }
  for (const option of options) {
    if (isOptionsGroup.isOptionsGroup(option)) {
      validateOptions(option.items, valuesSet);
    } else {
      if (typeof option.value === "undefined") {
        throw new Error("[@mantine/core] Each option must have value property");
      }
      if (typeof option.value !== "string") {
        throw new Error(
          `[@mantine/core] Option value must be a string, other data formats are not supported, got ${typeof option.value}`
        );
      }
      if (valuesSet.has(option.value)) {
        throw new Error(
          `[@mantine/core] Duplicate options are not supported. Option with value "${option.value}" was provided more than once`
        );
      }
      valuesSet.add(option.value);
    }
  }
}

exports.validateOptions = validateOptions;
//# sourceMappingURL=validate-options.cjs.map
