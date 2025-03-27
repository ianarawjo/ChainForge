'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');

function createOptionalContext(initialValue = null) {
  const Context = React.createContext(initialValue);
  const useOptionalContext = () => React.useContext(Context);
  const Provider = ({ children, value }) => /* @__PURE__ */ jsxRuntime.jsx(Context.Provider, { value, children });
  return [Provider, useOptionalContext];
}

exports.createOptionalContext = createOptionalContext;
//# sourceMappingURL=create-optional-context.cjs.map
