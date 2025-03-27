'use client';
'use strict';

var React = require('react');
var hooks = require('@mantine/hooks');

function useLockScroll({ opened, transitionDuration }) {
  const [shouldLockScroll, setShouldLockScroll] = React.useState(opened);
  const timeout = React.useRef(-1);
  const reduceMotion = hooks.useReducedMotion();
  const _transitionDuration = reduceMotion ? 0 : transitionDuration;
  React.useEffect(() => {
    if (opened) {
      setShouldLockScroll(true);
      window.clearTimeout(timeout.current);
    } else if (_transitionDuration === 0) {
      setShouldLockScroll(false);
    } else {
      timeout.current = window.setTimeout(() => setShouldLockScroll(false), _transitionDuration);
    }
    return () => window.clearTimeout(timeout.current);
  }, [opened, _transitionDuration]);
  return shouldLockScroll;
}

exports.useLockScroll = useLockScroll;
//# sourceMappingURL=use-lock-scroll.cjs.map
