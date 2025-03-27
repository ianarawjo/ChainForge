'use client';
import { useState, useEffect } from 'react';
import { useWindowEvent } from '../use-window-event/use-window-event.mjs';

function useHash({ getInitialValueInEffect = true } = {}) {
  const [hash, setHash] = useState(
    getInitialValueInEffect ? "" : window.location.hash || ""
  );
  const setHashHandler = (value) => {
    const valueWithHash = value.startsWith("#") ? value : `#${value}`;
    window.location.hash = valueWithHash;
    setHash(valueWithHash);
  };
  useWindowEvent("hashchange", () => {
    const newHash = window.location.hash;
    if (hash !== newHash) {
      setHash(newHash);
    }
  });
  useEffect(() => {
    if (getInitialValueInEffect) {
      setHash(window.location.hash);
    }
  }, []);
  return [hash, setHashHandler];
}

export { useHash };
//# sourceMappingURL=use-hash.mjs.map
