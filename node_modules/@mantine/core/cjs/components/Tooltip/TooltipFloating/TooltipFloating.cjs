'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var isElement = require('../../../core/utils/is-element/is-element.cjs');
var getDefaultZIndex = require('../../../core/utils/get-default-z-index/get-default-z-index.cjs');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
var getRefProp = require('../../../core/utils/get-ref-prop/get-ref-prop.cjs');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var getStyleObject = require('../../../core/Box/get-style-object/get-style-object.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
require('../../Portal/Portal.cjs');
var OptionalPortal = require('../../Portal/OptionalPortal.cjs');
var useFloatingTooltip = require('./use-floating-tooltip.cjs');
var Tooltip_module = require('../Tooltip.module.css.cjs');

const defaultProps = {
  refProp: "ref",
  withinPortal: true,
  offset: 10,
  defaultOpened: false,
  position: "right",
  zIndex: getDefaultZIndex.getDefaultZIndex("popover")
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { radius, color }) => ({
  tooltip: {
    "--tooltip-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
    "--tooltip-bg": color ? getThemeColor.getThemeColor(color, theme) : void 0,
    "--tooltip-color": color ? "var(--mantine-color-white)" : void 0
  }
}));
const TooltipFloating = factory.factory((_props, ref) => {
  const props = useProps.useProps("TooltipFloating", defaultProps, _props);
  const {
    children,
    refProp,
    withinPortal,
    style,
    className,
    classNames,
    styles,
    unstyled,
    radius,
    color,
    label,
    offset,
    position,
    multiline,
    zIndex,
    disabled,
    defaultOpened,
    variant,
    vars,
    portalProps,
    ...others
  } = props;
  const theme = MantineThemeProvider.useMantineTheme();
  const getStyles = useStyles.useStyles({
    name: "TooltipFloating",
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
  const { handleMouseMove, x, y, opened, boundaryRef, floating, setOpened } = useFloatingTooltip.useFloatingTooltip({
    offset,
    position,
    defaultOpened
  });
  if (!isElement.isElement(children)) {
    throw new Error(
      "[@mantine/core] Tooltip.Floating component children should be an element or a component that accepts ref, fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const targetRef = hooks.useMergedRef(boundaryRef, getRefProp.getRefProp(children), ref);
  const _childrenProps = children.props;
  const onMouseEnter = (event) => {
    _childrenProps.onMouseEnter?.(event);
    handleMouseMove(event);
    setOpened(true);
  };
  const onMouseLeave = (event) => {
    _childrenProps.onMouseLeave?.(event);
    setOpened(false);
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(OptionalPortal.OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ...others,
        ...getStyles("tooltip", {
          style: {
            ...getStyleObject.getStyleObject(style, theme),
            zIndex,
            display: !disabled && opened ? "block" : "none",
            top: (y && Math.round(y)) ?? "",
            left: (x && Math.round(x)) ?? ""
          }
        }),
        variant,
        ref: floating,
        mod: { multiline },
        children: label
      }
    ) }),
    React.cloneElement(children, {
      ..._childrenProps,
      [refProp]: targetRef,
      onMouseEnter,
      onMouseLeave
    })
  ] });
});
TooltipFloating.classes = Tooltip_module;
TooltipFloating.displayName = "@mantine/core/TooltipFloating";

exports.TooltipFloating = TooltipFloating;
//# sourceMappingURL=TooltipFloating.cjs.map
