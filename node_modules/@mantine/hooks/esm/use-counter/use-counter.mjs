'use client';
import { useState } from 'react';
import { clamp } from '../utils/clamp/clamp.mjs';

const DEFAULT_OPTIONS = {
  min: -Infinity,
  max: Infinity
};
function useCounter(initialValue = 0, options) {
  const { min, max } = { ...DEFAULT_OPTIONS, ...options };
  const [count, setCount] = useState(clamp(initialValue, min, max));
  const increment = () => setCount((current) => clamp(current + 1, min, max));
  const decrement = () => setCount((current) => clamp(current - 1, min, max));
  const set = (value) => setCount(clamp(value, min, max));
  const reset = () => setCount(clamp(initialValue, min, max));
  return [count, { increment, decrement, set, reset }];
}

export { useCounter };
//# sourceMappingURL=use-counter.mjs.map
