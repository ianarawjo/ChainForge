'use client';
'use strict';

var hooks = require('@mantine/hooks');

function dispatchEvent(type, detail) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}
function createUseExternalEvents(prefix) {
  function _useExternalEvents(events) {
    const handlers = Object.keys(events).reduce((acc, eventKey) => {
      acc[`${prefix}:${eventKey}`] = (event) => events[eventKey](event.detail);
      return acc;
    }, {});
    hooks.useIsomorphicEffect(() => {
      Object.keys(handlers).forEach((eventKey) => {
        window.removeEventListener(eventKey, handlers[eventKey]);
        window.addEventListener(eventKey, handlers[eventKey]);
      });
      return () => Object.keys(handlers).forEach((eventKey) => {
        window.removeEventListener(eventKey, handlers[eventKey]);
      });
    }, [handlers]);
  }
  function createEvent(event) {
    return (...payload) => dispatchEvent(`${prefix}:${String(event)}`, payload[0]);
  }
  return [_useExternalEvents, createEvent];
}

exports.createUseExternalEvents = createUseExternalEvents;
//# sourceMappingURL=create-use-external-events.cjs.map
