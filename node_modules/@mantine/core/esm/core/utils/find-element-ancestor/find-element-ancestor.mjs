'use client';
function findElementAncestor(element, selector) {
  let _element = element;
  while ((_element = _element.parentElement) && !_element.matches(selector)) {
  }
  return _element;
}

export { findElementAncestor };
//# sourceMappingURL=find-element-ancestor.mjs.map
