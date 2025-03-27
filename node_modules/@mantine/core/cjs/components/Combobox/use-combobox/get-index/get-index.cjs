'use client';
'use strict';

function getPreviousIndex(currentIndex, elements, loop) {
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if (!elements[i].hasAttribute("data-combobox-disabled")) {
      return i;
    }
  }
  if (loop) {
    for (let i = elements.length - 1; i > -1; i -= 1) {
      if (!elements[i].hasAttribute("data-combobox-disabled")) {
        return i;
      }
    }
  }
  return currentIndex;
}
function getNextIndex(currentIndex, elements, loop) {
  for (let i = currentIndex + 1; i < elements.length; i += 1) {
    if (!elements[i].hasAttribute("data-combobox-disabled")) {
      return i;
    }
  }
  if (loop) {
    for (let i = 0; i < elements.length; i += 1) {
      if (!elements[i].hasAttribute("data-combobox-disabled")) {
        return i;
      }
    }
  }
  return currentIndex;
}
function getFirstIndex(elements) {
  for (let i = 0; i < elements.length; i += 1) {
    if (!elements[i].hasAttribute("data-combobox-disabled")) {
      return i;
    }
  }
  return -1;
}

exports.getFirstIndex = getFirstIndex;
exports.getNextIndex = getNextIndex;
exports.getPreviousIndex = getPreviousIndex;
//# sourceMappingURL=get-index.cjs.map
