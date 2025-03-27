'use client';
'use strict';

var noop = require('../noop/noop.cjs');

function closeOnEscape(callback, options = { active: true }) {
  if (typeof callback !== "function" || !options.active) {
    return options.onKeyDown || noop.noop;
  }
  return (event) => {
    if (event.key === "Escape") {
      callback(event);
      options.onTrigger?.();
    }
  };
}

exports.closeOnEscape = closeOnEscape;
//# sourceMappingURL=close-on-escape.cjs.map
