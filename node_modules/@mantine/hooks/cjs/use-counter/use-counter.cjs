'use client';
'use strict';

var React = require('react');
var clamp = require('../utils/clamp/clamp.cjs');

const DEFAULT_OPTIONS = {
  min: -Infinity,
  max: Infinity
};
function useCounter(initialValue = 0, options) {
  const { min, max } = { ...DEFAULT_OPTIONS, ...options };
  const [count, setCount] = React.useState(clamp.clamp(initialValue, min, max));
  const increment = () => setCount((current) => clamp.clamp(current + 1, min, max));
  const decrement = () => setCount((current) => clamp.clamp(current - 1, min, max));
  const set = (value) => setCount(clamp.clamp(value, min, max));
  const reset = () => setCount(clamp.clamp(initialValue, min, max));
  return [count, { increment, decrement, set, reset }];
}

exports.useCounter = useCounter;
//# sourceMappingURL=use-counter.cjs.map
