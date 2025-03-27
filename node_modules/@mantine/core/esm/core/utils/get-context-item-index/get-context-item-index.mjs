'use client';
import { findElementAncestor } from '../find-element-ancestor/find-element-ancestor.mjs';

function getContextItemIndex(elementSelector, parentSelector, node) {
  if (!node) {
    return null;
  }
  return Array.from(
    findElementAncestor(node, parentSelector)?.querySelectorAll(elementSelector) || []
  ).findIndex((element) => element === node);
}

export { getContextItemIndex };
//# sourceMappingURL=get-context-item-index.mjs.map
