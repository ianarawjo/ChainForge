'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useRef, useEffect } from 'react';
import { useMove, clampUseMovePosition } from '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useColorPickerContext } from '../ColorPicker.context.mjs';
import { convertHsvaTo } from '../converters/converters.mjs';
import { Thumb } from '../Thumb/Thumb.mjs';

function Saturation({
  className,
  onChange,
  onChangeEnd,
  value,
  saturationLabel,
  focusable = true,
  size,
  color,
  onScrubStart,
  onScrubEnd,
  ...others
}) {
  const { getStyles } = useColorPickerContext();
  const [position, setPosition] = useState({ x: value.s / 100, y: 1 - value.v / 100 });
  const positionRef = useRef(position);
  const { ref } = useMove(
    ({ x, y }) => {
      positionRef.current = { x, y };
      onChange({ s: Math.round(x * 100), v: Math.round((1 - y) * 100) });
    },
    {
      onScrubEnd: () => {
        const { x, y } = positionRef.current;
        onChangeEnd({ s: Math.round(x * 100), v: Math.round((1 - y) * 100) });
        onScrubEnd?.();
      },
      onScrubStart
    }
  );
  useEffect(() => {
    setPosition({ x: value.s / 100, y: 1 - value.v / 100 });
  }, [value.s, value.v]);
  const handleArrow = (event, pos) => {
    event.preventDefault();
    const _position = clampUseMovePosition(pos);
    onChange({ s: Math.round(_position.x * 100), v: Math.round((1 - _position.y) * 100) });
    onChangeEnd({ s: Math.round(_position.x * 100), v: Math.round((1 - _position.y) * 100) });
  };
  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowUp": {
        handleArrow(event, { y: position.y - 0.05, x: position.x });
        break;
      }
      case "ArrowDown": {
        handleArrow(event, { y: position.y + 0.05, x: position.x });
        break;
      }
      case "ArrowRight": {
        handleArrow(event, { x: position.x + 0.05, y: position.y });
        break;
      }
      case "ArrowLeft": {
        handleArrow(event, { x: position.x - 0.05, y: position.y });
        break;
      }
    }
  };
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ...getStyles("saturation"),
      ref,
      ...others,
      role: "slider",
      "aria-label": saturationLabel,
      "aria-valuenow": position.x,
      "aria-valuetext": convertHsvaTo("rgba", value),
      tabIndex: focusable ? 0 : -1,
      onKeyDown: handleKeyDown,
      children: [
        /* @__PURE__ */ jsx(
          "div",
          {
            ...getStyles("saturationOverlay", {
              style: { backgroundColor: `hsl(${value.h}, 100%, 50%)` }
            })
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            ...getStyles("saturationOverlay", {
              style: { backgroundImage: "linear-gradient(90deg, #fff, transparent)" }
            })
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            ...getStyles("saturationOverlay", {
              style: { backgroundImage: "linear-gradient(0deg, #000, transparent)" }
            })
          }
        ),
        /* @__PURE__ */ jsx(Thumb, { position, ...getStyles("thumb", { style: { backgroundColor: color } }) })
      ]
    }
  );
}
Saturation.displayName = "@mantine/core/Saturation";

export { Saturation };
//# sourceMappingURL=Saturation.mjs.map
