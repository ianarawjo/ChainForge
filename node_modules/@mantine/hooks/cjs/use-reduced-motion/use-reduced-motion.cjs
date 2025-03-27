'use client';
'use strict';

var useMediaQuery = require('../use-media-query/use-media-query.cjs');

function useReducedMotion(initialValue, options) {
  return useMediaQuery.useMediaQuery("(prefers-reduced-motion: reduce)", initialValue, options);
}

exports.useReducedMotion = useReducedMotion;
//# sourceMappingURL=use-reduced-motion.cjs.map
