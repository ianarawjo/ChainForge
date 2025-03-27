'use client';
'use strict';

var React = require('react');
var useForceUpdate = require('../use-force-update/use-force-update.cjs');

function useSet(values) {
  const setRef = React.useRef(new Set(values));
  const forceUpdate = useForceUpdate.useForceUpdate();
  setRef.current.add = (...args) => {
    const res = Set.prototype.add.apply(setRef.current, args);
    forceUpdate();
    return res;
  };
  setRef.current.clear = (...args) => {
    Set.prototype.clear.apply(setRef.current, args);
    forceUpdate();
  };
  setRef.current.delete = (...args) => {
    const res = Set.prototype.delete.apply(setRef.current, args);
    forceUpdate();
    return res;
  };
  return setRef.current;
}

exports.useSet = useSet;
//# sourceMappingURL=use-set.cjs.map
