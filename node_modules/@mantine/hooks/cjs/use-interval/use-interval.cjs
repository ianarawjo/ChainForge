'use client';
'use strict';

var React = require('react');

function useInterval(fn, interval, { autoInvoke = false } = {}) {
  const [active, setActive] = React.useState(false);
  const intervalRef = React.useRef(null);
  const fnRef = React.useRef(null);
  const start = () => {
    setActive((old) => {
      if (!old && (!intervalRef.current || intervalRef.current === -1)) {
        intervalRef.current = window.setInterval(fnRef.current, interval);
      }
      return true;
    });
  };
  const stop = () => {
    setActive(false);
    window.clearInterval(intervalRef.current || -1);
    intervalRef.current = -1;
  };
  const toggle = () => {
    if (active) {
      stop();
    } else {
      start();
    }
  };
  React.useEffect(() => {
    fnRef.current = fn;
    active && start();
    return stop;
  }, [fn, active, interval]);
  React.useEffect(() => {
    if (autoInvoke) {
      start();
    }
  }, []);
  return { start, stop, toggle, active };
}

exports.useInterval = useInterval;
//# sourceMappingURL=use-interval.cjs.map
