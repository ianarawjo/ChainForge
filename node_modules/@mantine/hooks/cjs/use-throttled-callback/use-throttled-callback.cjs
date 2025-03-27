'use client';
'use strict';

var React = require('react');
var useCallbackRef = require('../use-callback-ref/use-callback-ref.cjs');

function useThrottledCallbackWithClearTimeout(callback, wait) {
  const handleCallback = useCallbackRef.useCallbackRef(callback);
  const latestInArgsRef = React.useRef(null);
  const latestOutArgsRef = React.useRef(null);
  const active = React.useRef(true);
  const waitRef = React.useRef(wait);
  const timeoutRef = React.useRef(-1);
  const clearTimeout = () => window.clearTimeout(timeoutRef.current);
  const callThrottledCallback = React.useCallback(
    (...args) => {
      handleCallback(...args);
      latestInArgsRef.current = args;
      latestOutArgsRef.current = args;
      active.current = false;
    },
    [handleCallback]
  );
  const timerCallback = React.useCallback(() => {
    if (latestInArgsRef.current && latestInArgsRef.current !== latestOutArgsRef.current) {
      callThrottledCallback(...latestInArgsRef.current);
      timeoutRef.current = window.setTimeout(timerCallback, waitRef.current);
    } else {
      active.current = true;
    }
  }, [callThrottledCallback]);
  const throttled = React.useCallback(
    (...args) => {
      if (active.current) {
        callThrottledCallback(...args);
        timeoutRef.current = window.setTimeout(timerCallback, waitRef.current);
      } else {
        latestInArgsRef.current = args;
      }
    },
    [callThrottledCallback, timerCallback]
  );
  React.useEffect(() => {
    waitRef.current = wait;
  }, [wait]);
  return [throttled, clearTimeout];
}
function useThrottledCallback(callback, wait) {
  return useThrottledCallbackWithClearTimeout(callback, wait)[0];
}

exports.useThrottledCallback = useThrottledCallback;
exports.useThrottledCallbackWithClearTimeout = useThrottledCallbackWithClearTimeout;
//# sourceMappingURL=use-throttled-callback.cjs.map
