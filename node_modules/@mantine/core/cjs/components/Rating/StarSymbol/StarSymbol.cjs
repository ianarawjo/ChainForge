'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Rating_context = require('../Rating.context.cjs');
var StarIcon = require('./StarIcon.cjs');

function StarSymbol({ type }) {
  const ctx = Rating_context.useRatingContext();
  return /* @__PURE__ */ jsxRuntime.jsx(StarIcon.StarIcon, { ...ctx.getStyles("starSymbol"), "data-filled": type === "full" || void 0 });
}
StarSymbol.displayName = "@mantine/core/StarSymbol";

exports.StarSymbol = StarSymbol;
//# sourceMappingURL=StarSymbol.cjs.map
