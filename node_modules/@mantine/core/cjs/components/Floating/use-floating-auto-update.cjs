'use client';
'use strict';

var React = require('react');
var react = require('@floating-ui/react');
var hooks = require('@mantine/hooks');

function useFloatingAutoUpdate({
  opened,
  floating,
  position,
  positionDependencies
}) {
  const [delayedUpdate, setDelayedUpdate] = React.useState(0);
  React.useEffect(() => {
    if (floating.refs.reference.current && floating.refs.floating.current && opened) {
      return react.autoUpdate(
        floating.refs.reference.current,
        floating.refs.floating.current,
        floating.update
      );
    }
    return void 0;
  }, [
    floating.refs.reference.current,
    floating.refs.floating.current,
    opened,
    delayedUpdate,
    position
  ]);
  hooks.useDidUpdate(() => {
    floating.update();
  }, positionDependencies);
  hooks.useDidUpdate(() => {
    setDelayedUpdate((c) => c + 1);
  }, [opened]);
}

exports.useFloatingAutoUpdate = useFloatingAutoUpdate;
//# sourceMappingURL=use-floating-auto-update.cjs.map
