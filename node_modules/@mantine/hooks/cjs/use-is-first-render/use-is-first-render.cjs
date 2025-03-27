'use client';
'use strict';

var React = require('react');

function useIsFirstRender() {
  const renderRef = React.useRef(true);
  if (renderRef.current === true) {
    renderRef.current = false;
    return true;
  }
  return renderRef.current;
}

exports.useIsFirstRender = useIsFirstRender;
//# sourceMappingURL=use-is-first-render.cjs.map
