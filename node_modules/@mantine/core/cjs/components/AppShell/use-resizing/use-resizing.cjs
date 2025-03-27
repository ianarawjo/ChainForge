'use client';
'use strict';

var React = require('react');
var hooks = require('@mantine/hooks');

function useResizing({ transitionDuration, disabled }) {
  const [resizing, setResizing] = React.useState(true);
  const resizingTimeout = React.useRef(-1);
  const disabledTimeout = React.useRef(-1);
  hooks.useWindowEvent("resize", () => {
    setResizing(true);
    clearTimeout(resizingTimeout.current);
    resizingTimeout.current = window.setTimeout(
      () => React.startTransition(() => {
        setResizing(false);
      }),
      200
    );
  });
  hooks.useIsomorphicEffect(() => {
    setResizing(true);
    clearTimeout(disabledTimeout.current);
    disabledTimeout.current = window.setTimeout(
      () => React.startTransition(() => {
        setResizing(false);
      }),
      transitionDuration || 0
    );
  }, [disabled, transitionDuration]);
  return resizing;
}

exports.useResizing = useResizing;
//# sourceMappingURL=use-resizing.cjs.map
