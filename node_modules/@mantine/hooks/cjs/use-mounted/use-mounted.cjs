'use client';
'use strict';

var React = require('react');

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

exports.useMounted = useMounted;
//# sourceMappingURL=use-mounted.cjs.map
