'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { useRef, cloneElement } from 'react';
import cx from 'clsx';
import { useMergedRef } from '@mantine/hooks';
import { isElement } from '../../core/utils/is-element/is-element.mjs';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import { getRefProp } from '../../core/utils/get-ref-prop/get-ref-prop.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import { useDirection } from '../../core/DirectionProvider/DirectionProvider.mjs';
import '@floating-ui/react';
import { getFloatingPosition } from '../Floating/get-floating-position/get-floating-position.mjs';
import { FloatingArrow } from '../Floating/FloatingArrow/FloatingArrow.mjs';
import '../Portal/Portal.mjs';
import { OptionalPortal } from '../Portal/OptionalPortal.mjs';
import { Transition } from '../Transition/Transition.mjs';
import { getTransitionProps } from '../Transition/get-transition-props/get-transition-props.mjs';
import { TooltipFloating } from './TooltipFloating/TooltipFloating.mjs';
import { TooltipGroup } from './TooltipGroup/TooltipGroup.mjs';
import { useTooltip } from './use-tooltip.mjs';
import classes from './Tooltip.module.css.mjs';

const defaultProps = {
  position: "top",
  refProp: "ref",
  withinPortal: true,
  inline: false,
  defaultOpened: false,
  arrowSize: 4,
  arrowOffset: 5,
  arrowRadius: 0,
  arrowPosition: "side",
  offset: 5,
  transitionProps: { duration: 100, transition: "fade" },
  events: { hover: true, focus: false, touch: false },
  zIndex: getDefaultZIndex("popover"),
  positionDependencies: [],
  middlewares: { flip: true, shift: true, inline: false }
};
const varsResolver = createVarsResolver((theme, { radius, color }) => ({
  tooltip: {
    "--tooltip-radius": radius === void 0 ? void 0 : getRadius(radius),
    "--tooltip-bg": color ? getThemeColor(color, theme) : void 0,
    "--tooltip-color": color ? "var(--mantine-color-white)" : void 0
  }
}));
const Tooltip = factory((_props, ref) => {
  const props = useProps("Tooltip", defaultProps, _props);
  const {
    children,
    position,
    refProp,
    label,
    openDelay,
    closeDelay,
    onPositionChange,
    opened,
    defaultOpened,
    withinPortal,
    radius,
    color,
    classNames,
    styles,
    unstyled,
    style,
    className,
    withArrow,
    arrowSize,
    arrowOffset,
    arrowRadius,
    arrowPosition,
    offset,
    transitionProps,
    multiline,
    events,
    zIndex,
    disabled,
    positionDependencies,
    onClick,
    onMouseEnter,
    onMouseLeave,
    inline,
    variant,
    keepMounted,
    vars,
    portalProps,
    mod,
    floatingStrategy,
    middlewares,
    ...others
  } = useProps("Tooltip", defaultProps, props);
  const { dir } = useDirection();
  const arrowRef = useRef(null);
  const tooltip = useTooltip({
    position: getFloatingPosition(dir, position),
    closeDelay,
    openDelay,
    onPositionChange,
    opened,
    defaultOpened,
    events,
    arrowRef,
    arrowOffset,
    offset: typeof offset === "number" ? offset + (withArrow ? arrowSize / 2 : 0) : offset,
    positionDependencies: [...positionDependencies, children],
    inline,
    strategy: floatingStrategy,
    middlewares
  });
  const getStyles = useStyles({
    name: "Tooltip",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "tooltip",
    vars,
    varsResolver
  });
  if (!isElement(children)) {
    throw new Error(
      "[@mantine/core] Tooltip component children should be an element or a component that accepts ref, fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const targetRef = useMergedRef(tooltip.reference, getRefProp(children), ref);
  const transition = getTransitionProps(transitionProps, { duration: 100, transition: "fade" });
  const _childrenProps = children.props;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsx(
      Transition,
      {
        ...transition,
        keepMounted,
        mounted: !disabled && !!tooltip.opened,
        duration: tooltip.isGroupPhase ? 10 : transition.duration,
        children: (transitionStyles) => /* @__PURE__ */ jsxs(
          Box,
          {
            ...others,
            "data-fixed": floatingStrategy === "fixed" || void 0,
            variant,
            mod: [{ multiline }, mod],
            ...tooltip.getFloatingProps({
              ref: tooltip.floating,
              className: getStyles("tooltip").className,
              style: {
                ...getStyles("tooltip").style,
                ...transitionStyles,
                zIndex,
                top: tooltip.y ?? 0,
                left: tooltip.x ?? 0
              }
            }),
            children: [
              label,
              /* @__PURE__ */ jsx(
                FloatingArrow,
                {
                  ref: arrowRef,
                  arrowX: tooltip.arrowX,
                  arrowY: tooltip.arrowY,
                  visible: withArrow,
                  position: tooltip.placement,
                  arrowSize,
                  arrowOffset,
                  arrowRadius,
                  arrowPosition,
                  ...getStyles("arrow")
                }
              )
            ]
          }
        )
      }
    ) }),
    cloneElement(
      children,
      tooltip.getReferenceProps({
        onClick,
        onMouseEnter,
        onMouseLeave,
        onMouseMove: props.onMouseMove,
        onPointerDown: props.onPointerDown,
        onPointerEnter: props.onPointerEnter,
        className: cx(className, _childrenProps.className),
        ..._childrenProps,
        [refProp]: targetRef
      })
    )
  ] });
});
Tooltip.classes = classes;
Tooltip.displayName = "@mantine/core/Tooltip";
Tooltip.Floating = TooltipFloating;
Tooltip.Group = TooltipGroup;

export { Tooltip };
//# sourceMappingURL=Tooltip.mjs.map
