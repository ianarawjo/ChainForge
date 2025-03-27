'use client';
'use strict';

function getSelectorClassName({ selector, classes, unstyled }) {
  return unstyled ? void 0 : classes[selector];
}

exports.getSelectorClassName = getSelectorClassName;
//# sourceMappingURL=get-selector-class-name.cjs.map
