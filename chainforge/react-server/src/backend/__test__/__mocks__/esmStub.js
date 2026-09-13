/* eslint-disable */
// Permissive stub for ESM-only packages that CRA's CommonJS Jest cannot parse.
// Any named import resolves to a no-op function, which is enough for suites
// that never exercise the stubbed library. Written as CommonJS .js on purpose:
// it has to be requireable by Jest without transformation.
const noop = function () {
  return undefined;
};
module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "__esModule") return true;
      if (prop === "default") return noop;
      return noop;
    },
  },
);
