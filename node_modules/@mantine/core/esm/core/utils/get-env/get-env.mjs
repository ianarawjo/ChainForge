'use client';
function getEnv() {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  return "development";
}

export { getEnv };
//# sourceMappingURL=get-env.mjs.map
