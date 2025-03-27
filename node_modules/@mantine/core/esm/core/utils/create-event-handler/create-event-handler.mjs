'use client';
function createEventHandler(parentEventHandler, eventHandler) {
  return (event) => {
    parentEventHandler?.(event);
    eventHandler?.(event);
  };
}

export { createEventHandler };
//# sourceMappingURL=create-event-handler.mjs.map
