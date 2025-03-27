'use client';
import { noop } from '../noop/noop.mjs';

function closeOnEscape(callback, options = { active: true }) {
  if (typeof callback !== "function" || !options.active) {
    return options.onKeyDown || noop;
  }
  return (event) => {
    if (event.key === "Escape") {
      callback(event);
      options.onTrigger?.();
    }
  };
}

export { closeOnEscape };
//# sourceMappingURL=close-on-escape.mjs.map
