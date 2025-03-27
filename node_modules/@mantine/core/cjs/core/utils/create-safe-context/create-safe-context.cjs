'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');

function createSafeContext(errorMessage) {
  const Context = React.createContext(null);
  const useSafeContext = () => {
    const ctx = React.useContext(Context);
    if (ctx === null) {
      throw new Error(errorMessage);
    }
    return ctx;
  };
  const Provider = ({ children, value }) => /* @__PURE__ */ jsxRuntime.jsx(Context.Provider, { value, children });
  return [Provider, useSafeContext];
}

exports.createSafeContext = createSafeContext;
//# sourceMappingURL=create-safe-context.cjs.map
