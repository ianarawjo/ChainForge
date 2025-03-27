'use client';
'use strict';

function composeEventHandlers(originalEventHandler, ourEventHandler, { checkForDefaultPrevented = true } = {}) {
  return (event) => {
    originalEventHandler?.(event);
    if (checkForDefaultPrevented === false || !event.defaultPrevented) {
      ourEventHandler?.(event);
    }
  };
}

exports.composeEventHandlers = composeEventHandlers;
//# sourceMappingURL=compose-event-handlers.cjs.map
