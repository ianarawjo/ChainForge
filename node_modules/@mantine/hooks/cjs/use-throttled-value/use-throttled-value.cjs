'use client';
'use strict';

var React = require('react');
var useThrottledCallback = require('../use-throttled-callback/use-throttled-callback.cjs');

function useThrottledValue(value, wait) {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const valueRef = React.useRef(value);
  const [throttledSetValue, clearTimeout] = useThrottledCallback.useThrottledCallbackWithClearTimeout(
    setThrottledValue,
    wait
  );
  React.useEffect(() => {
    if (value !== valueRef.current) {
      valueRef.current = value;
      throttledSetValue(value);
    }
  }, [throttledSetValue, value]);
  React.useEffect(() => clearTimeout, []);
  return throttledValue;
}

exports.useThrottledValue = useThrottledValue;
//# sourceMappingURL=use-throttled-value.cjs.map
