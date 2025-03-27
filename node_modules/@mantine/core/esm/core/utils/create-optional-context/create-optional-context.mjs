'use client';
import { jsx } from 'react/jsx-runtime';
import { createContext, useContext } from 'react';

function createOptionalContext(initialValue = null) {
  const Context = createContext(initialValue);
  const useOptionalContext = () => useContext(Context);
  const Provider = ({ children, value }) => /* @__PURE__ */ jsx(Context.Provider, { value, children });
  return [Provider, useOptionalContext];
}

export { createOptionalContext };
//# sourceMappingURL=create-optional-context.mjs.map
