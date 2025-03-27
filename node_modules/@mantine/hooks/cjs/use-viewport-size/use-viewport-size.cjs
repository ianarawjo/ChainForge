'use client';
'use strict';

var React = require('react');
var useWindowEvent = require('../use-window-event/use-window-event.cjs');

const eventListerOptions = {
  passive: true
};
function useViewportSize() {
  const [windowSize, setWindowSize] = React.useState({
    width: 0,
    height: 0
  });
  const setSize = React.useCallback(() => {
    setWindowSize({ width: window.innerWidth || 0, height: window.innerHeight || 0 });
  }, []);
  useWindowEvent.useWindowEvent("resize", setSize, eventListerOptions);
  useWindowEvent.useWindowEvent("orientationchange", setSize, eventListerOptions);
  React.useEffect(setSize, []);
  return windowSize;
}

exports.useViewportSize = useViewportSize;
//# sourceMappingURL=use-viewport-size.cjs.map
