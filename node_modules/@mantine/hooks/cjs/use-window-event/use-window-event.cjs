'use client';
'use strict';

var React = require('react');

function useWindowEvent(type, listener, options) {
  React.useEffect(() => {
    window.addEventListener(type, listener, options);
    return () => window.removeEventListener(type, listener, options);
  }, [type, listener]);
}

exports.useWindowEvent = useWindowEvent;
//# sourceMappingURL=use-window-event.cjs.map
