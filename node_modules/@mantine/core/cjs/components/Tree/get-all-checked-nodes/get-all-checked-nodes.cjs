'use client';
'use strict';

function getAllCheckedNodes(data, checkedState, acc = []) {
  const currentTreeChecked = [];
  for (const node of data) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      const innerChecked = getAllCheckedNodes(node.children, checkedState, acc);
      if (innerChecked.currentTreeChecked.length === node.children.length) {
        const isChecked = innerChecked.currentTreeChecked.every((item2) => item2.checked);
        const item = {
          checked: isChecked,
          indeterminate: !isChecked,
          value: node.value,
          hasChildren: true
        };
        currentTreeChecked.push(item);
        acc.push(item);
      } else if (innerChecked.currentTreeChecked.length > 0) {
        const item = { checked: false, indeterminate: true, value: node.value, hasChildren: true };
        currentTreeChecked.push(item);
        acc.push(item);
      }
    } else if (checkedState.includes(node.value)) {
      const item = {
        checked: true,
        indeterminate: false,
        value: node.value,
        hasChildren: false
      };
      currentTreeChecked.push(item);
      acc.push(item);
    }
  }
  return { result: acc, currentTreeChecked };
}

exports.getAllCheckedNodes = getAllCheckedNodes;
//# sourceMappingURL=get-all-checked-nodes.cjs.map
