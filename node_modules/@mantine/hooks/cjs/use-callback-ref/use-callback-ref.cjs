'use client';
'use strict';

var React = require('react');

function useCallbackRef(callback) {
  const callbackRef = React.useRef(callback);
  React.useEffect(() => {
    callbackRef.current = callback;
  });
  return React.useMemo(() => (...args) => callbackRef.current?.(...args), []);
}

exports.useCallbackRef = useCallbackRef;
//# sourceMappingURL=use-callback-ref.cjs.map
