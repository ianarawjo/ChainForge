'use client';
'use strict';

var React = require('react');

function useDelayedHover({ open, close, openDelay, closeDelay }) {
  const openTimeout = React.useRef(-1);
  const closeTimeout = React.useRef(-1);
  const clearTimeouts = () => {
    window.clearTimeout(openTimeout.current);
    window.clearTimeout(closeTimeout.current);
  };
  const openDropdown = () => {
    clearTimeouts();
    if (openDelay === 0 || openDelay === void 0) {
      open();
    } else {
      openTimeout.current = window.setTimeout(open, openDelay);
    }
  };
  const closeDropdown = () => {
    clearTimeouts();
    if (closeDelay === 0 || closeDelay === void 0) {
      close();
    } else {
      closeTimeout.current = window.setTimeout(close, closeDelay);
    }
  };
  React.useEffect(() => clearTimeouts, []);
  return { openDropdown, closeDropdown };
}

exports.useDelayedHover = useDelayedHover;
//# sourceMappingURL=use-delayed-hover.cjs.map
