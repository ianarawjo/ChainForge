'use client';
'use strict';

function findElementAncestor(element, selector) {
  let _element = element;
  while ((_element = _element.parentElement) && !_element.matches(selector)) {
  }
  return _element;
}

exports.findElementAncestor = findElementAncestor;
//# sourceMappingURL=find-element-ancestor.cjs.map
