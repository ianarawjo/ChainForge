'use client';
import { useState, useRef, useEffect } from 'react';
import { useThrottledCallbackWithClearTimeout } from '../use-throttled-callback/use-throttled-callback.mjs';

function useThrottledValue(value, wait) {
  const [throttledValue, setThrottledValue] = useState(value);
  const valueRef = useRef(value);
  const [throttledSetValue, clearTimeout] = useThrottledCallbackWithClearTimeout(
    setThrottledValue,
    wait
  );
  useEffect(() => {
    if (value !== valueRef.current) {
      valueRef.current = value;
      throttledSetValue(value);
    }
  }, [throttledSetValue, value]);
  useEffect(() => clearTimeout, []);
  return throttledValue;
}

export { useThrottledValue };
//# sourceMappingURL=use-throttled-value.mjs.map
