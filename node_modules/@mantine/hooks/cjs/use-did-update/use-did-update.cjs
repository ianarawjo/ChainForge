'use client';
'use strict';

var React = require('react');

function useDidUpdate(fn, dependencies) {
  const mounted = React.useRef(false);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  React.useEffect(() => {
    if (mounted.current) {
      return fn();
    }
    mounted.current = true;
    return void 0;
  }, dependencies);
}

exports.useDidUpdate = useDidUpdate;
//# sourceMappingURL=use-did-update.cjs.map
