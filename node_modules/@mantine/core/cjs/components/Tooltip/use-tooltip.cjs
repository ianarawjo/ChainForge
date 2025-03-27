'use client';
'use strict';

var React = require('react');
var react = require('@floating-ui/react');
var hooks = require('@mantine/hooks');
var useFloatingAutoUpdate = require('../Floating/use-floating-auto-update.cjs');
require('../Floating/FloatingArrow/FloatingArrow.cjs');
var TooltipGroup_context = require('./TooltipGroup/TooltipGroup.context.cjs');

function getDefaultMiddlewares(middlewares) {
  if (middlewares === void 0) {
    return { shift: true, flip: true };
  }
  const result = { ...middlewares };
  if (middlewares.shift === void 0) {
    result.shift = true;
  }
  if (middlewares.flip === void 0) {
    result.flip = true;
  }
  return result;
}
function getTooltipMiddlewares(settings) {
  const middlewaresOptions = getDefaultMiddlewares(settings.middlewares);
  const middlewares = [react.offset(settings.offset)];
  if (middlewaresOptions.shift) {
    middlewares.push(
      react.shift(
        typeof middlewaresOptions.shift === "boolean" ? { padding: 8 } : { padding: 8, ...middlewaresOptions.shift }
      )
    );
  }
  if (middlewaresOptions.flip) {
    middlewares.push(
      typeof middlewaresOptions.flip === "boolean" ? react.flip() : react.flip(middlewaresOptions.flip)
    );
  }
  middlewares.push(react.arrow({ element: settings.arrowRef, padding: settings.arrowOffset }));
  if (middlewaresOptions.inline) {
    middlewares.push(
      typeof middlewaresOptions.inline === "boolean" ? react.inline() : react.inline(middlewaresOptions.inline)
    );
  } else if (settings.inline) {
    middlewares.push(react.inline());
  }
  return middlewares;
}
function useTooltip(settings) {
  const [uncontrolledOpened, setUncontrolledOpened] = React.useState(settings.defaultOpened);
  const controlled = typeof settings.opened === "boolean";
  const opened = controlled ? settings.opened : uncontrolledOpened;
  const withinGroup = TooltipGroup_context.useTooltipGroupContext();
  const uid = hooks.useId();
  const onChange = React.useCallback(
    (_opened) => {
      setUncontrolledOpened(_opened);
      if (_opened) {
        setCurrentId(uid);
      }
    },
    [uid]
  );
  const {
    x,
    y,
    context,
    refs,
    update,
    placement,
    middlewareData: { arrow: { x: arrowX, y: arrowY } = {} }
  } = react.useFloating({
    strategy: settings.strategy,
    placement: settings.position,
    open: opened,
    onOpenChange: onChange,
    middleware: getTooltipMiddlewares(settings)
  });
  const { delay: groupDelay, currentId, setCurrentId } = react.useDelayGroup(context, { id: uid });
  const { getReferenceProps, getFloatingProps } = react.useInteractions([
    react.useHover(context, {
      enabled: settings.events?.hover,
      delay: withinGroup ? groupDelay : { open: settings.openDelay, close: settings.closeDelay },
      mouseOnly: !settings.events?.touch
    }),
    react.useFocus(context, { enabled: settings.events?.focus, visibleOnly: true }),
    react.useRole(context, { role: "tooltip" }),
    // Cannot be used with controlled tooltip, page jumps
    react.useDismiss(context, { enabled: typeof settings.opened === "undefined" })
  ]);
  useFloatingAutoUpdate.useFloatingAutoUpdate({
    opened,
    position: settings.position,
    positionDependencies: settings.positionDependencies,
    floating: { refs, update }
  });
  hooks.useDidUpdate(() => {
    settings.onPositionChange?.(placement);
  }, [placement]);
  const isGroupPhase = opened && currentId && currentId !== uid;
  return {
    x,
    y,
    arrowX,
    arrowY,
    reference: refs.setReference,
    floating: refs.setFloating,
    getFloatingProps,
    getReferenceProps,
    isGroupPhase,
    opened,
    placement
  };
}

exports.useTooltip = useTooltip;
//# sourceMappingURL=use-tooltip.cjs.map
