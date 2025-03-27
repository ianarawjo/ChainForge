'use client';
import { useState, useRef, useEffect } from 'react';

function useDebouncedValue(value, wait, options = { leading: false }) {
  const [_value, setValue] = useState(value);
  const mountedRef = useRef(false);
  const timeoutRef = useRef(null);
  const cooldownRef = useRef(false);
  const cancel = () => window.clearTimeout(timeoutRef.current);
  useEffect(() => {
    if (mountedRef.current) {
      if (!cooldownRef.current && options.leading) {
        cooldownRef.current = true;
        setValue(value);
      } else {
        cancel();
        timeoutRef.current = window.setTimeout(() => {
          cooldownRef.current = false;
          setValue(value);
        }, wait);
      }
    }
  }, [value, options.leading, wait]);
  useEffect(() => {
    mountedRef.current = true;
    return cancel;
  }, []);
  return [_value, cancel];
}

export { useDebouncedValue };
//# sourceMappingURL=use-debounced-value.mjs.map
