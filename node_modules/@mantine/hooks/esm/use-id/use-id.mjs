'use client';
import { useState } from 'react';
import { useIsomorphicEffect } from '../use-isomorphic-effect/use-isomorphic-effect.mjs';
import { randomId } from '../utils/random-id/random-id.mjs';
import { useReactId } from './use-react-id.mjs';

function useId(staticId) {
  const reactId = useReactId();
  const [uuid, setUuid] = useState(reactId);
  useIsomorphicEffect(() => {
    setUuid(randomId());
  }, []);
  if (typeof staticId === "string") {
    return staticId;
  }
  if (typeof window === "undefined") {
    return reactId;
  }
  return uuid;
}

export { useId };
//# sourceMappingURL=use-id.mjs.map
