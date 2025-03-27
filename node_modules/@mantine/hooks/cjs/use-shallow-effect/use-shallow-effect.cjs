'use client';
'use strict';

var React = require('react');
var shallowEqual = require('../utils/shallow-equal/shallow-equal.cjs');

function shallowCompare(prevValue, currValue) {
  if (!prevValue || !currValue) {
    return false;
  }
  if (prevValue === currValue) {
    return true;
  }
  if (prevValue.length !== currValue.length) {
    return false;
  }
  for (let i = 0; i < prevValue.length; i += 1) {
    if (!shallowEqual.shallowEqual(prevValue[i], currValue[i])) {
      return false;
    }
  }
  return true;
}
function useShallowCompare(dependencies) {
  const ref = React.useRef([]);
  const updateRef = React.useRef(0);
  if (!shallowCompare(ref.current, dependencies)) {
    ref.current = dependencies;
    updateRef.current += 1;
  }
  return [updateRef.current];
}
function useShallowEffect(cb, dependencies) {
  React.useEffect(cb, useShallowCompare(dependencies));
}

exports.useShallowEffect = useShallowEffect;
//# sourceMappingURL=use-shallow-effect.cjs.map
