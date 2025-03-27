'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { cloneElement } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { isElement } from '../../../core/utils/is-element/is-element.mjs';
import { getDefaultZIndex } from '../../../core/utils/get-default-z-index/get-default-z-index.mjs';
import { getRadius } from '../../../core/utils/get-size/get-size.mjs';
import { getRefProp } from '../../../core/utils/get-ref-prop/get-ref-prop.mjs';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { getStyleObject } from '../../../core/Box/get-style-object/get-style-object.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import '../../Portal/Portal.mjs';
import { OptionalPortal } from '../../Portal/OptionalPortal.mjs';
import { useFloatingTooltip } from './use-floating-tooltip.mjs';
import classes from '../Tooltip.module.css.mjs';

const defaultProps = {
  refProp: "ref",
  withinPortal: true,
  offset: 10,
  defaultOpened: false,
  position: "right",
  zIndex: getDefaultZIndex("popover")
};
const varsResolver = createVarsResolver((theme, { radius, color }) => ({
  tooltip: {
    "--tooltip-radius": radius === void 0 ? void 0 : getRadius(radius),
    "--tooltip-bg": color ? getThemeColor(color, theme) : void 0,
    "--tooltip-color": color ? "var(--mantine-color-white)" : void 0
  }
}));
const TooltipFloating = factory((_props, ref) => {
  const props = useProps("TooltipFloating", defaultProps, _props);
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
  const theme = useMantineTheme();
  const getStyles = useStyles({
    name: "TooltipFloating",
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
  const { handleMouseMove, x, y, opened, boundaryRef, floating, setOpened } = useFloatingTooltip({
    offset,
    position,
    defaultOpened
  });
  if (!isElement(children)) {
    throw new Error(
      "[@mantine/core] Tooltip.Floating component children should be an element or a component that accepts ref, fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const targetRef = useMergedRef(boundaryRef, getRefProp(children), ref);
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
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsx(
      Box,
      {
        ...others,
        ...getStyles("tooltip", {
          style: {
            ...getStyleObject(style, theme),
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
    cloneElement(children, {
      ..._childrenProps,
      [refProp]: targetRef,
      onMouseEnter,
      onMouseLeave
    })
  ] });
});
TooltipFloating.classes = classes;
TooltipFloating.displayName = "@mantine/core/TooltipFloating";

export { TooltipFloating };
//# sourceMappingURL=TooltipFloating.mjs.map
