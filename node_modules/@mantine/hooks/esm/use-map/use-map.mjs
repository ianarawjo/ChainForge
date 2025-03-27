'use client';
import { useRef } from 'react';
import { useForceUpdate } from '../use-force-update/use-force-update.mjs';

function useMap(initialState) {
  const mapRef = useRef(new Map(initialState));
  const forceUpdate = useForceUpdate();
  mapRef.current.set = (...args) => {
    Map.prototype.set.apply(mapRef.current, args);
    forceUpdate();
    return mapRef.current;
  };
  mapRef.current.clear = (...args) => {
    Map.prototype.clear.apply(mapRef.current, args);
    forceUpdate();
  };
  mapRef.current.delete = (...args) => {
    const res = Map.prototype.delete.apply(mapRef.current, args);
    forceUpdate();
    return res;
  };
  return mapRef.current;
}

export { useMap };
//# sourceMappingURL=use-map.mjs.map
