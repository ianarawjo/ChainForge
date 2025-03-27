'use client';
import { useState, useCallback } from 'react';
import { useFloating, useDelayGroup, useInteractions, useHover, useFocus, useRole, useDismiss, offset, shift, flip, arrow, inline } from '@floating-ui/react';
import { useId, useDidUpdate } from '@mantine/hooks';
import { useFloatingAutoUpdate } from '../Floating/use-floating-auto-update.mjs';
import '../Floating/FloatingArrow/FloatingArrow.mjs';
import { useTooltipGroupContext } from './TooltipGroup/TooltipGroup.context.mjs';

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
  const middlewares = [offset(settings.offset)];
  if (middlewaresOptions.shift) {
    middlewares.push(
      shift(
        typeof middlewaresOptions.shift === "boolean" ? { padding: 8 } : { padding: 8, ...middlewaresOptions.shift }
      )
    );
  }
  if (middlewaresOptions.flip) {
    middlewares.push(
      typeof middlewaresOptions.flip === "boolean" ? flip() : flip(middlewaresOptions.flip)
    );
  }
  middlewares.push(arrow({ element: settings.arrowRef, padding: settings.arrowOffset }));
  if (middlewaresOptions.inline) {
    middlewares.push(
      typeof middlewaresOptions.inline === "boolean" ? inline() : inline(middlewaresOptions.inline)
    );
  } else if (settings.inline) {
    middlewares.push(inline());
  }
  return middlewares;
}
function useTooltip(settings) {
  const [uncontrolledOpened, setUncontrolledOpened] = useState(settings.defaultOpened);
  const controlled = typeof settings.opened === "boolean";
  const opened = controlled ? settings.opened : uncontrolledOpened;
  const withinGroup = useTooltipGroupContext();
  const uid = useId();
  const onChange = useCallback(
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
  } = useFloating({
    strategy: settings.strategy,
    placement: settings.position,
    open: opened,
    onOpenChange: onChange,
    middleware: getTooltipMiddlewares(settings)
  });
  const { delay: groupDelay, currentId, setCurrentId } = useDelayGroup(context, { id: uid });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, {
      enabled: settings.events?.hover,
      delay: withinGroup ? groupDelay : { open: settings.openDelay, close: settings.closeDelay },
      mouseOnly: !settings.events?.touch
    }),
    useFocus(context, { enabled: settings.events?.focus, visibleOnly: true }),
    useRole(context, { role: "tooltip" }),
    // Cannot be used with controlled tooltip, page jumps
    useDismiss(context, { enabled: typeof settings.opened === "undefined" })
  ]);
  useFloatingAutoUpdate({
    opened,
    position: settings.position,
    positionDependencies: settings.positionDependencies,
    floating: { refs, update }
  });
  useDidUpdate(() => {
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

export { useTooltip };
//# sourceMappingURL=use-tooltip.mjs.map
