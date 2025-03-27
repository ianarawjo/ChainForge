'use client';
'use strict';

var React = require('react');
var useForceUpdate = require('../use-force-update/use-force-update.cjs');

function useMap(initialState) {
  const mapRef = React.useRef(new Map(initialState));
  const forceUpdate = useForceUpdate.useForceUpdate();
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

exports.useMap = useMap;
//# sourceMappingURL=use-map.cjs.map
