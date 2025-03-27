'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { forwardRef, useState } from 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Transition } from '../../Transition/Transition.mjs';
import { useSliderContext } from '../Slider.context.mjs';

const Thumb = forwardRef(
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
    const { getStyles } = useSliderContext();
    const [focused, setFocused] = useState(false);
    const isVisible = labelAlwaysOn || dragging || focused || showLabelOnHover && isHovered;
    return /* @__PURE__ */ jsxs(
      Box,
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
          /* @__PURE__ */ jsx(
            Transition,
            {
              mounted: label != null && !!isVisible,
              transition: "fade",
              duration: 0,
              ...labelTransitionProps,
              children: (transitionStyles) => /* @__PURE__ */ jsx("div", { ...getStyles("label", { style: transitionStyles }), children: label })
            }
          )
        ]
      }
    );
  }
);
Thumb.displayName = "@mantine/core/SliderThumb";

export { Thumb };
//# sourceMappingURL=Thumb.mjs.map
