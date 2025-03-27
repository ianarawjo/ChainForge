'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var cx = require('clsx');
var hooks = require('@mantine/hooks');
var isElement = require('../../core/utils/is-element/is-element.cjs');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var getRefProp = require('../../core/utils/get-ref-prop/get-ref-prop.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
var DirectionProvider = require('../../core/DirectionProvider/DirectionProvider.cjs');
require('@floating-ui/react');
var getFloatingPosition = require('../Floating/get-floating-position/get-floating-position.cjs');
var FloatingArrow = require('../Floating/FloatingArrow/FloatingArrow.cjs');
require('../Portal/Portal.cjs');
var OptionalPortal = require('../Portal/OptionalPortal.cjs');
var Transition = require('../Transition/Transition.cjs');
var getTransitionProps = require('../Transition/get-transition-props/get-transition-props.cjs');
var TooltipFloating = require('./TooltipFloating/TooltipFloating.cjs');
var TooltipGroup = require('./TooltipGroup/TooltipGroup.cjs');
var useTooltip = require('./use-tooltip.cjs');
var Tooltip_module = require('./Tooltip.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

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
  zIndex: getDefaultZIndex.getDefaultZIndex("popover"),
  positionDependencies: [],
  middlewares: { flip: true, shift: true, inline: false }
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { radius, color }) => ({
  tooltip: {
    "--tooltip-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
    "--tooltip-bg": color ? getThemeColor.getThemeColor(color, theme) : void 0,
    "--tooltip-color": color ? "var(--mantine-color-white)" : void 0
  }
}));
const Tooltip = factory.factory((_props, ref) => {
  const props = useProps.useProps("Tooltip", defaultProps, _props);
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
  } = useProps.useProps("Tooltip", defaultProps, props);
  const { dir } = DirectionProvider.useDirection();
  const arrowRef = React.useRef(null);
  const tooltip = useTooltip.useTooltip({
    position: getFloatingPosition.getFloatingPosition(dir, position),
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
  const getStyles = useStyles.useStyles({
    name: "Tooltip",
    props,
    classes: Tooltip_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "tooltip",
    vars,
    varsResolver
  });
  if (!isElement.isElement(children)) {
    throw new Error(
      "[@mantine/core] Tooltip component children should be an element or a component that accepts ref, fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const targetRef = hooks.useMergedRef(tooltip.reference, getRefProp.getRefProp(children), ref);
  const transition = getTransitionProps.getTransitionProps(transitionProps, { duration: 100, transition: "fade" });
  const _childrenProps = children.props;
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(OptionalPortal.OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsxRuntime.jsx(
      Transition.Transition,
      {
        ...transition,
        keepMounted,
        mounted: !disabled && !!tooltip.opened,
        duration: tooltip.isGroupPhase ? 10 : transition.duration,
        children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsxs(
          Box.Box,
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
              /* @__PURE__ */ jsxRuntime.jsx(
                FloatingArrow.FloatingArrow,
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
    React.cloneElement(
      children,
      tooltip.getReferenceProps({
        onClick,
        onMouseEnter,
        onMouseLeave,
        onMouseMove: props.onMouseMove,
        onPointerDown: props.onPointerDown,
        onPointerEnter: props.onPointerEnter,
        className: cx__default.default(className, _childrenProps.className),
        ..._childrenProps,
        [refProp]: targetRef
      })
    )
  ] });
});
Tooltip.classes = Tooltip_module;
Tooltip.displayName = "@mantine/core/Tooltip";
Tooltip.Floating = TooltipFloating.TooltipFloating;
Tooltip.Group = TooltipGroup.TooltipGroup;

exports.Tooltip = Tooltip;
//# sourceMappingURL=Tooltip.cjs.map
