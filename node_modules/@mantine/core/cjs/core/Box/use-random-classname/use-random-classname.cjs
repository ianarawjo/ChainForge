'use client';
'use strict';

var React = require('react');

function useRandomClassName() {
  const id = React.useId().replace(/:/g, "");
  return `__m__-${id}`;
}

exports.useRandomClassName = useRandomClassName;
//# sourceMappingURL=use-random-classname.cjs.map
