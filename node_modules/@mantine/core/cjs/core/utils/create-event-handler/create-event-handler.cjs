'use client';
'use strict';

function createEventHandler(parentEventHandler, eventHandler) {
  return (event) => {
    parentEventHandler?.(event);
    eventHandler?.(event);
  };
}

exports.createEventHandler = createEventHandler;
//# sourceMappingURL=create-event-handler.cjs.map
