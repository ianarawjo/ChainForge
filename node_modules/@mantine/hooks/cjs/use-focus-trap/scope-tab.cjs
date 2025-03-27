'use client';
'use strict';

var tabbable = require('./tabbable.cjs');

function scopeTab(node, event) {
  const tabbable$1 = tabbable.findTabbableDescendants(node);
  if (!tabbable$1.length) {
    event.preventDefault();
    return;
  }
  const finalTabbable = tabbable$1[event.shiftKey ? 0 : tabbable$1.length - 1];
  const root = node.getRootNode();
  let leavingFinalTabbable = finalTabbable === root.activeElement || node === root.activeElement;
  const activeElement = root.activeElement;
  const activeElementIsRadio = activeElement.tagName === "INPUT" && activeElement.getAttribute("type") === "radio";
  if (activeElementIsRadio) {
    const activeRadioGroup = tabbable$1.filter(
      (element) => element.getAttribute("type") === "radio" && element.getAttribute("name") === activeElement.getAttribute("name")
    );
    leavingFinalTabbable = activeRadioGroup.includes(finalTabbable);
  }
  if (!leavingFinalTabbable) {
    return;
  }
  event.preventDefault();
  const target = tabbable$1[event.shiftKey ? tabbable$1.length - 1 : 0];
  if (target) {
    target.focus();
  }
}

exports.scopeTab = scopeTab;
//# sourceMappingURL=scope-tab.cjs.map
