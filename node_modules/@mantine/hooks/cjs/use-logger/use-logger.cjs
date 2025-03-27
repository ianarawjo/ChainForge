'use client';
'use strict';

var React = require('react');
var useDidUpdate = require('../use-did-update/use-did-update.cjs');

function useLogger(componentName, props) {
  React.useEffect(() => {
    console.log(`${componentName} mounted`, ...props);
    return () => console.log(`${componentName} unmounted`);
  }, []);
  useDidUpdate.useDidUpdate(() => {
    console.log(`${componentName} updated`, ...props);
  }, props);
  return null;
}

exports.useLogger = useLogger;
//# sourceMappingURL=use-logger.cjs.map
