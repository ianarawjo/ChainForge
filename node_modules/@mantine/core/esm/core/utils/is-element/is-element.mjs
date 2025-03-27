'use client';
import { Fragment } from 'react';

function isElement(value) {
  if (Array.isArray(value) || value === null) {
    return false;
  }
  if (typeof value === "object") {
    if (value.type === Fragment) {
      return false;
    }
    return true;
  }
  return false;
}

export { isElement };
//# sourceMappingURL=is-element.mjs.map
