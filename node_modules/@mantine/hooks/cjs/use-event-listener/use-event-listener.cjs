'use client';
'use strict';

var React = require('react');

function useEventListener(type, listener, options) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener(type, listener, options);
      return () => node?.removeEventListener(type, listener, options);
    }
    return void 0;
  }, [listener, options]);
  return ref;
}

exports.useEventListener = useEventListener;
//# sourceMappingURL=use-event-listener.cjs.map
