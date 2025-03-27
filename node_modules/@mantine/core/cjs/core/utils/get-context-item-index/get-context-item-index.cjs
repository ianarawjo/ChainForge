'use client';
'use strict';

var findElementAncestor = require('../find-element-ancestor/find-element-ancestor.cjs');

function getContextItemIndex(elementSelector, parentSelector, node) {
  if (!node) {
    return null;
  }
  return Array.from(
    findElementAncestor.findElementAncestor(node, parentSelector)?.querySelectorAll(elementSelector) || []
  ).findIndex((element) => element === node);
}

exports.getContextItemIndex = getContextItemIndex;
//# sourceMappingURL=get-context-item-index.cjs.map
