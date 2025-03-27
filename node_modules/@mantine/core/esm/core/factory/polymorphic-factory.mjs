'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { identity } from './factory.mjs';

function polymorphicFactory(ui) {
  const Component = forwardRef(ui);
  Component.withProps = (fixedProps) => {
    const Extended = forwardRef((props, ref) => /* @__PURE__ */ jsx(Component, { ...fixedProps, ...props, ref }));
    Extended.extend = Component.extend;
    Extended.displayName = `WithProps(${Component.displayName})`;
    return Extended;
  };
  Component.extend = identity;
  return Component;
}

export { polymorphicFactory };
//# sourceMappingURL=polymorphic-factory.mjs.map
