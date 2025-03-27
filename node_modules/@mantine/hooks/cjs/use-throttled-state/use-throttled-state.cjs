'use client';
'use strict';

var React = require('react');
var useThrottledCallback = require('../use-throttled-callback/use-throttled-callback.cjs');

function useThrottledState(defaultValue, wait) {
  const [value, setValue] = React.useState(defaultValue);
  const [setThrottledValue, clearTimeout] = useThrottledCallback.useThrottledCallbackWithClearTimeout(setValue, wait);
  React.useEffect(() => clearTimeout, []);
  return [value, setThrottledValue];
}

exports.useThrottledState = useThrottledState;
//# sourceMappingURL=use-throttled-state.cjs.map
