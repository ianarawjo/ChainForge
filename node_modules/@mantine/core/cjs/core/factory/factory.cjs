'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');

function identity(value) {
  return value;
}
function getWithProps(Component) {
  const _Component = Component;
  return (fixedProps) => {
    const Extended = React.forwardRef((props, ref) => /* @__PURE__ */ jsxRuntime.jsx(_Component, { ...fixedProps, ...props, ref }));
    Extended.extend = _Component.extend;
    Extended.displayName = `WithProps(${_Component.displayName})`;
    return Extended;
  };
}
function factory(ui) {
  const Component = React.forwardRef(ui);
  Component.extend = identity;
  Component.withProps = (fixedProps) => {
    const Extended = React.forwardRef((props, ref) => /* @__PURE__ */ jsxRuntime.jsx(Component, { ...fixedProps, ...props, ref }));
    Extended.extend = Component.extend;
    Extended.displayName = `WithProps(${Component.displayName})`;
    return Extended;
  };
  return Component;
}

exports.factory = factory;
exports.getWithProps = getWithProps;
exports.identity = identity;
//# sourceMappingURL=factory.cjs.map
