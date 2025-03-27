'use client';
import { useState, useCallback } from 'react';
import { useIsomorphicEffect } from '../use-isomorphic-effect/use-isomorphic-effect.mjs';

function isOpera() {
  return navigator.userAgent.includes("OPR");
}
function useEyeDropper() {
  const [supported, setSupported] = useState(false);
  useIsomorphicEffect(() => {
    setSupported(typeof window !== "undefined" && !isOpera() && "EyeDropper" in window);
  }, []);
  const open = useCallback(
    (options = {}) => {
      if (supported) {
        const eyeDropper = new window.EyeDropper();
        return eyeDropper.open(options);
      }
      return Promise.resolve(void 0);
    },
    [supported]
  );
  return { supported, open };
}

export { useEyeDropper };
//# sourceMappingURL=use-eye-dropper.mjs.map
