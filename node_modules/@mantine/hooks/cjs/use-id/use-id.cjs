'use client';
'use strict';

var React = require('react');
var useIsomorphicEffect = require('../use-isomorphic-effect/use-isomorphic-effect.cjs');
var randomId = require('../utils/random-id/random-id.cjs');
var useReactId = require('./use-react-id.cjs');

function useId(staticId) {
  const reactId = useReactId.useReactId();
  const [uuid, setUuid] = React.useState(reactId);
  useIsomorphicEffect.useIsomorphicEffect(() => {
    setUuid(randomId.randomId());
  }, []);
  if (typeof staticId === "string") {
    return staticId;
  }
  if (typeof window === "undefined") {
    return reactId;
  }
  return uuid;
}

exports.useId = useId;
//# sourceMappingURL=use-id.cjs.map
