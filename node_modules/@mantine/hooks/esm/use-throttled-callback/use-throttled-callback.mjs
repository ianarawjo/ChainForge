'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useCallbackRef } from '../use-callback-ref/use-callback-ref.mjs';

function useThrottledCallbackWithClearTimeout(callback, wait) {
  const handleCallback = useCallbackRef(callback);
  const latestInArgsRef = useRef(null);
  const latestOutArgsRef = useRef(null);
  const active = useRef(true);
  const waitRef = useRef(wait);
  const timeoutRef = useRef(-1);
  const clearTimeout = () => window.clearTimeout(timeoutRef.current);
  const callThrottledCallback = useCallback(
    (...args) => {
      handleCallback(...args);
      latestInArgsRef.current = args;
      latestOutArgsRef.current = args;
      active.current = false;
    },
    [handleCallback]
  );
  const timerCallback = useCallback(() => {
    if (latestInArgsRef.current && latestInArgsRef.current !== latestOutArgsRef.current) {
      callThrottledCallback(...latestInArgsRef.current);
      timeoutRef.current = window.setTimeout(timerCallback, waitRef.current);
    } else {
      active.current = true;
    }
  }, [callThrottledCallback]);
  const throttled = useCallback(
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
  useEffect(() => {
    waitRef.current = wait;
  }, [wait]);
  return [throttled, clearTimeout];
}
function useThrottledCallback(callback, wait) {
  return useThrottledCallbackWithClearTimeout(callback, wait)[0];
}

export { useThrottledCallback, useThrottledCallbackWithClearTimeout };
//# sourceMappingURL=use-throttled-callback.mjs.map
