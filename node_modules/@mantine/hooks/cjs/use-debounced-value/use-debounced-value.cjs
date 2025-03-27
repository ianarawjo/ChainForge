'use client';
'use strict';

var React = require('react');

function useDebouncedValue(value, wait, options = { leading: false }) {
  const [_value, setValue] = React.useState(value);
  const mountedRef = React.useRef(false);
  const timeoutRef = React.useRef(null);
  const cooldownRef = React.useRef(false);
  const cancel = () => window.clearTimeout(timeoutRef.current);
  React.useEffect(() => {
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
  React.useEffect(() => {
    mountedRef.current = true;
    return cancel;
  }, []);
  return [_value, cancel];
}

exports.useDebouncedValue = useDebouncedValue;
//# sourceMappingURL=use-debounced-value.cjs.map
