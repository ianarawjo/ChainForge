'use client';
'use strict';

var React = require('react');

function useTimeout(callback, delay, options = { autoInvoke: false }) {
  const timeoutRef = React.useRef(null);
  const start = React.useCallback(
    (...callbackParams) => {
      if (!timeoutRef.current) {
        timeoutRef.current = window.setTimeout(() => {
          callback(callbackParams);
          timeoutRef.current = null;
        }, delay);
      }
    },
    [delay]
  );
  const clear = React.useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  React.useEffect(() => {
    if (options.autoInvoke) {
      start();
    }
    return clear;
  }, [clear, start]);
  return { start, clear };
}

exports.useTimeout = useTimeout;
//# sourceMappingURL=use-timeout.cjs.map
