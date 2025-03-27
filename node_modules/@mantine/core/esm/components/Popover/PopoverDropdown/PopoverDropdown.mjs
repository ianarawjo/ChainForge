'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useFocusReturn, useMergedRef } from '@mantine/hooks';
import { rem } from '../../../core/utils/units-converters/rem.mjs';
import 'react';
import { closeOnEscape } from '../../../core/utils/close-on-escape/close-on-escape.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import '@floating-ui/react';
import { FloatingArrow } from '../../Floating/FloatingArrow/FloatingArrow.mjs';
import { FocusTrap } from '../../FocusTrap/FocusTrap.mjs';
import '../../Portal/Portal.mjs';
import { OptionalPortal } from '../../Portal/OptionalPortal.mjs';
import { Transition } from '../../Transition/Transition.mjs';
import { usePopoverContext } from '../Popover.context.mjs';
import classes from '../Popover.module.css.mjs';

const defaultProps = {};
const PopoverDropdown = factory((_props, ref) => {
  const props = useProps("PopoverDropdown", defaultProps, _props);
  const {
    className,
    style,
    vars,
    children,
    onKeyDownCapture,
    variant,
    classNames,
    styles,
    ...others
  } = props;
  const ctx = usePopoverContext();
  const returnFocus = useFocusReturn({
    opened: ctx.opened,
    shouldReturnFocus: ctx.returnFocus
  });
  const accessibleProps = ctx.withRoles ? {
    "aria-labelledby": ctx.getTargetId(),
    id: ctx.getDropdownId(),
    role: "dialog",
    tabIndex: -1
  } : {};
  const mergedRef = useMergedRef(ref, ctx.floating);
  if (ctx.disabled) {
    return null;
  }
  return /* @__PURE__ */ jsx(OptionalPortal, { ...ctx.portalProps, withinPortal: ctx.withinPortal, children: /* @__PURE__ */ jsx(
    Transition,
    {
      mounted: ctx.opened,
      ...ctx.transitionProps,
      transition: ctx.transitionProps?.transition || "fade",
      duration: ctx.transitionProps?.duration ?? 150,
      keepMounted: ctx.keepMounted,
      exitDuration: typeof ctx.transitionProps?.exitDuration === "number" ? ctx.transitionProps.exitDuration : ctx.transitionProps?.duration,
      children: (transitionStyles) => /* @__PURE__ */ jsx(FocusTrap, { active: ctx.trapFocus && ctx.opened, innerRef: mergedRef, children: /* @__PURE__ */ jsxs(
        Box,
        {
          ...accessibleProps,
          ...others,
          variant,
          onKeyDownCapture: closeOnEscape(
            () => {
              ctx.onClose?.();
              ctx.onDismiss?.();
            },
            {
              active: ctx.closeOnEscape,
              onTrigger: returnFocus,
              onKeyDown: onKeyDownCapture
            }
          ),
          "data-position": ctx.placement,
          "data-fixed": ctx.floatingStrategy === "fixed" || void 0,
          ...ctx.getStyles("dropdown", {
            className,
            props,
            classNames,
            styles,
            style: [
              {
                ...transitionStyles,
                zIndex: ctx.zIndex,
                top: ctx.y ?? 0,
                left: ctx.x ?? 0,
                width: ctx.width === "target" ? void 0 : rem(ctx.width)
              },
              ctx.resolvedStyles.dropdown,
              styles?.dropdown,
              style
            ]
          }),
          children: [
            children,
            /* @__PURE__ */ jsx(
              FloatingArrow,
              {
                ref: ctx.arrowRef,
                arrowX: ctx.arrowX,
                arrowY: ctx.arrowY,
                visible: ctx.withArrow,
                position: ctx.placement,
                arrowSize: ctx.arrowSize,
                arrowRadius: ctx.arrowRadius,
                arrowOffset: ctx.arrowOffset,
                arrowPosition: ctx.arrowPosition,
                ...ctx.getStyles("arrow", {
                  props,
                  classNames,
                  styles
                })
              }
            )
          ]
        }
      ) })
    }
  ) });
});
PopoverDropdown.classes = classes;
PopoverDropdown.displayName = "@mantine/core/PopoverDropdown";

export { PopoverDropdown };
//# sourceMappingURL=PopoverDropdown.mjs.map
