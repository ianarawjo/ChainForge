'use client';
import { useRef, useEffect } from 'react';

function usePrevious(value) {
  const ref = useRef(void 0);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export { usePrevious };
//# sourceMappingURL=use-previous.mjs.map
