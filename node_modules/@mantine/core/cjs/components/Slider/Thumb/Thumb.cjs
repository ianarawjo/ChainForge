'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Transition = require('../../Transition/Transition.cjs');
var Slider_context = require('../Slider.context.cjs');

const Thumb = React.forwardRef(
  ({
    max,
    min,
    value,
    position,
    label,
    dragging,
    onMouseDown,
    onKeyDownCapture,
    labelTransitionProps,
    labelAlwaysOn,
    thumbLabel,
    onFocus,
    onBlur,
    showLabelOnHover,
    isHovered,
    children = null,
    disabled
  }, ref) => {
    const { getStyles } = Slider_context.useSliderContext();
    const [focused, setFocused] = React.useState(false);
    const isVisible = labelAlwaysOn || dragging || focused || showLabelOnHover && isHovered;
    return /* @__PURE__ */ jsxRuntime.jsxs(
      Box.Box,
      {
        tabIndex: 0,
        role: "slider",
        "aria-label": thumbLabel,
        "aria-valuemax": max,
        "aria-valuemin": min,
        "aria-valuenow": value,
        ref,
        __vars: { "--slider-thumb-offset": `${position}%` },
        ...getStyles("thumb", { focusable: true }),
        mod: { dragging, disabled },
        onFocus: (event) => {
          setFocused(true);
          typeof onFocus === "function" && onFocus(event);
        },
        onBlur: (event) => {
          setFocused(false);
          typeof onBlur === "function" && onBlur(event);
        },
        onTouchStart: onMouseDown,
        onMouseDown,
        onKeyDownCapture,
        onClick: (event) => event.stopPropagation(),
        children: [
          children,
          /* @__PURE__ */ jsxRuntime.jsx(
            Transition.Transition,
            {
              mounted: label != null && !!isVisible,
              transition: "fade",
              duration: 0,
              ...labelTransitionProps,
              children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("label", { style: transitionStyles }), children: label })
            }
          )
        ]
      }
    );
  }
);
Thumb.displayName = "@mantine/core/SliderThumb";

exports.Thumb = Thumb;
//# sourceMappingURL=Thumb.cjs.map
