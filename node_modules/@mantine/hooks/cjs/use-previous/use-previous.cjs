'use client';
'use strict';

var React = require('react');

function usePrevious(value) {
  const ref = React.useRef(void 0);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

exports.usePrevious = usePrevious;
//# sourceMappingURL=use-previous.cjs.map
