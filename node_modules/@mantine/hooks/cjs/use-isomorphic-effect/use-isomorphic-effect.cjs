'use client';
'use strict';

var React = require('react');

const useIsomorphicEffect = typeof document !== "undefined" ? React.useLayoutEffect : React.useEffect;

exports.useIsomorphicEffect = useIsomorphicEffect;
//# sourceMappingURL=use-isomorphic-effect.cjs.map
