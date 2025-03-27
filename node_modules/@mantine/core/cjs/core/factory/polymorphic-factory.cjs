'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var factory = require('./factory.cjs');

function polymorphicFactory(ui) {
  const Component = React.forwardRef(ui);
  Component.withProps = (fixedProps) => {
    const Extended = React.forwardRef((props, ref) => /* @__PURE__ */ jsxRuntime.jsx(Component, { ...fixedProps, ...props, ref }));
    Extended.extend = Component.extend;
    Extended.displayName = `WithProps(${Component.displayName})`;
    return Extended;
  };
  Component.extend = factory.identity;
  return Component;
}

exports.polymorphicFactory = polymorphicFactory;
//# sourceMappingURL=polymorphic-factory.cjs.map
