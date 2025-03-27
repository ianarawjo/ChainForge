'use client';
import { useState, useEffect } from 'react';
import { autoUpdate } from '@floating-ui/react';
import { useDidUpdate } from '@mantine/hooks';

function useFloatingAutoUpdate({
  opened,
  floating,
  position,
  positionDependencies
}) {
  const [delayedUpdate, setDelayedUpdate] = useState(0);
  useEffect(() => {
    if (floating.refs.reference.current && floating.refs.floating.current && opened) {
      return autoUpdate(
        floating.refs.reference.current,
        floating.refs.floating.current,
        floating.update
      );
    }
    return void 0;
  }, [
    floating.refs.reference.current,
    floating.refs.floating.current,
    opened,
    delayedUpdate,
    position
  ]);
  useDidUpdate(() => {
    floating.update();
  }, positionDependencies);
  useDidUpdate(() => {
    setDelayedUpdate((c) => c + 1);
  }, [opened]);
}

export { useFloatingAutoUpdate };
//# sourceMappingURL=use-floating-auto-update.mjs.map
