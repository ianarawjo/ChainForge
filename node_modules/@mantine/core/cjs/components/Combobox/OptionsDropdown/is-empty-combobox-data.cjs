'use client';
'use strict';

function isEmptyComboboxData(data) {
  if (data.length === 0) {
    return true;
  }
  for (const item of data) {
    if (!("group" in item)) {
      return false;
    }
    if (item.items.length > 0) {
      return false;
    }
  }
  return true;
}

exports.isEmptyComboboxData = isEmptyComboboxData;
//# sourceMappingURL=is-empty-combobox-data.cjs.map
