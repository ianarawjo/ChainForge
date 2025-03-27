'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
var rem = require('../../../core/utils/units-converters/rem.cjs');
require('react');
var closeOnEscape = require('../../../core/utils/close-on-escape/close-on-escape.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
require('@floating-ui/react');
var FloatingArrow = require('../../Floating/FloatingArrow/FloatingArrow.cjs');
var FocusTrap = require('../../FocusTrap/FocusTrap.cjs');
require('../../Portal/Portal.cjs');
var OptionalPortal = require('../../Portal/OptionalPortal.cjs');
var Transition = require('../../Transition/Transition.cjs');
var Popover_context = require('../Popover.context.cjs');
var Popover_module = require('../Popover.module.css.cjs');

const defaultProps = {};
const PopoverDropdown = factory.factory((_props, ref) => {
  const props = useProps.useProps("PopoverDropdown", defaultProps, _props);
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
  const ctx = Popover_context.usePopoverContext();
  const returnFocus = hooks.useFocusReturn({
    opened: ctx.opened,
    shouldReturnFocus: ctx.returnFocus
  });
  const accessibleProps = ctx.withRoles ? {
    "aria-labelledby": ctx.getTargetId(),
    id: ctx.getDropdownId(),
    role: "dialog",
    tabIndex: -1
  } : {};
  const mergedRef = hooks.useMergedRef(ref, ctx.floating);
  if (ctx.disabled) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx(OptionalPortal.OptionalPortal, { ...ctx.portalProps, withinPortal: ctx.withinPortal, children: /* @__PURE__ */ jsxRuntime.jsx(
    Transition.Transition,
    {
      mounted: ctx.opened,
      ...ctx.transitionProps,
      transition: ctx.transitionProps?.transition || "fade",
      duration: ctx.transitionProps?.duration ?? 150,
      keepMounted: ctx.keepMounted,
      exitDuration: typeof ctx.transitionProps?.exitDuration === "number" ? ctx.transitionProps.exitDuration : ctx.transitionProps?.duration,
      children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx(FocusTrap.FocusTrap, { active: ctx.trapFocus && ctx.opened, innerRef: mergedRef, children: /* @__PURE__ */ jsxRuntime.jsxs(
        Box.Box,
        {
          ...accessibleProps,
          ...others,
          variant,
          onKeyDownCapture: closeOnEscape.closeOnEscape(
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
                width: ctx.width === "target" ? void 0 : rem.rem(ctx.width)
              },
              ctx.resolvedStyles.dropdown,
              styles?.dropdown,
              style
            ]
          }),
          children: [
            children,
            /* @__PURE__ */ jsxRuntime.jsx(
              FloatingArrow.FloatingArrow,
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
PopoverDropdown.classes = Popover_module;
PopoverDropdown.displayName = "@mantine/core/PopoverDropdown";

exports.PopoverDropdown = PopoverDropdown;
//# sourceMappingURL=PopoverDropdown.cjs.map
