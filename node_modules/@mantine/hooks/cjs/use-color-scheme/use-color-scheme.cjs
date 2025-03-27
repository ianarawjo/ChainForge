'use client';
'use strict';

var useMediaQuery = require('../use-media-query/use-media-query.cjs');

function useColorScheme(initialValue, options) {
  return useMediaQuery.useMediaQuery("(prefers-color-scheme: dark)", initialValue === "dark", options) ? "dark" : "light";
}

exports.useColorScheme = useColorScheme;
//# sourceMappingURL=use-color-scheme.cjs.map
