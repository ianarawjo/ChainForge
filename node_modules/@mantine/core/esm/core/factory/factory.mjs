'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';

function identity(value) {
  return value;
}
function getWithProps(Component) {
  const _Component = Component;
  return (fixedProps) => {
    const Extended = forwardRef((props, ref) => /* @__PURE__ */ jsx(_Component, { ...fixedProps, ...props, ref }));
    Extended.extend = _Component.extend;
    Extended.displayName = `WithProps(${_Component.displayName})`;
    return Extended;
  };
}
function factory(ui) {
  const Component = forwardRef(ui);
  Component.extend = identity;
  Component.withProps = (fixedProps) => {
    const Extended = forwardRef((props, ref) => /* @__PURE__ */ jsx(Component, { ...fixedProps, ...props, ref }));
    Extended.extend = Component.extend;
    Extended.displayName = `WithProps(${Component.displayName})`;
    return Extended;
  };
  return Component;
}

export { factory, getWithProps, identity };
//# sourceMappingURL=factory.mjs.map
