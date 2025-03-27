'use client';
import { useState, useRef, startTransition } from 'react';
import { useWindowEvent, useIsomorphicEffect } from '@mantine/hooks';

function useResizing({ transitionDuration, disabled }) {
  const [resizing, setResizing] = useState(true);
  const resizingTimeout = useRef(-1);
  const disabledTimeout = useRef(-1);
  useWindowEvent("resize", () => {
    setResizing(true);
    clearTimeout(resizingTimeout.current);
    resizingTimeout.current = window.setTimeout(
      () => startTransition(() => {
        setResizing(false);
      }),
      200
    );
  });
  useIsomorphicEffect(() => {
    setResizing(true);
    clearTimeout(disabledTimeout.current);
    disabledTimeout.current = window.setTimeout(
      () => startTransition(() => {
        setResizing(false);
      }),
      transitionDuration || 0
    );
  }, [disabled, transitionDuration]);
  return resizing;
}

export { useResizing };
//# sourceMappingURL=use-resizing.mjs.map
