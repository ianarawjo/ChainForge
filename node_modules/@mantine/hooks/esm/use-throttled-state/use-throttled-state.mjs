'use client';
import { useState, useEffect } from 'react';
import { useThrottledCallbackWithClearTimeout } from '../use-throttled-callback/use-throttled-callback.mjs';

function useThrottledState(defaultValue, wait) {
  const [value, setValue] = useState(defaultValue);
  const [setThrottledValue, clearTimeout] = useThrottledCallbackWithClearTimeout(setValue, wait);
  useEffect(() => clearTimeout, []);
  return [value, setThrottledValue];
}

export { useThrottledState };
//# sourceMappingURL=use-throttled-state.mjs.map
