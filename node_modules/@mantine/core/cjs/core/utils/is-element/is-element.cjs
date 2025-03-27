'use client';
'use strict';

var React = require('react');

function isElement(value) {
  if (Array.isArray(value) || value === null) {
    return false;
  }
  if (typeof value === "object") {
    if (value.type === React.Fragment) {
      return false;
    }
    return true;
  }
  return false;
}

exports.isElement = isElement;
//# sourceMappingURL=is-element.cjs.map
