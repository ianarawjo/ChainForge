'use client';
'use strict';

var React = require('react');
var useWindowEvent = require('../use-window-event/use-window-event.cjs');

function useHash({ getInitialValueInEffect = true } = {}) {
  const [hash, setHash] = React.useState(
    getInitialValueInEffect ? "" : window.location.hash || ""
  );
  const setHashHandler = (value) => {
    const valueWithHash = value.startsWith("#") ? value : `#${value}`;
    window.location.hash = valueWithHash;
    setHash(valueWithHash);
  };
  useWindowEvent.useWindowEvent("hashchange", () => {
    const newHash = window.location.hash;
    if (hash !== newHash) {
      setHash(newHash);
    }
  });
  React.useEffect(() => {
    if (getInitialValueInEffect) {
      setHash(window.location.hash);
    }
  }, []);
  return [hash, setHashHandler];
}

exports.useHash = useHash;
//# sourceMappingURL=use-hash.cjs.map
