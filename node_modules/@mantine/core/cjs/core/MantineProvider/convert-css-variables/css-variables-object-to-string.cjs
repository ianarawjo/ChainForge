'use client';
'use strict';

function cssVariablesObjectToString(variables) {
  return Object.entries(variables).map(([name, value]) => `${name}: ${value};`).join("");
}

exports.cssVariablesObjectToString = cssVariablesObjectToString;
//# sourceMappingURL=css-variables-object-to-string.cjs.map
