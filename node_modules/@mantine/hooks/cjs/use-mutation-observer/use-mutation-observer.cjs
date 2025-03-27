'use client';
'use strict';

var React = require('react');

function useMutationObserver(callback, options, target) {
  const observer = React.useRef(null);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const targetElement = typeof target === "function" ? target() : target;
    if (targetElement || ref.current) {
      observer.current = new MutationObserver(callback);
      observer.current.observe(targetElement || ref.current, options);
    }
    return () => {
      observer.current?.disconnect();
    };
  }, [callback, options]);
  return ref;
}

exports.useMutationObserver = useMutationObserver;
//# sourceMappingURL=use-mutation-observer.cjs.map
