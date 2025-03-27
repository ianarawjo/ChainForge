'use client';
'use strict';

function getEnv() {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  return "development";
}

exports.getEnv = getEnv;
//# sourceMappingURL=get-env.cjs.map
