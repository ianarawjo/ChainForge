'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var ColorPicker_context = require('../ColorPicker.context.cjs');
var converters = require('../converters/converters.cjs');
var Thumb = require('../Thumb/Thumb.cjs');

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
  const { getStyles } = ColorPicker_context.useColorPickerContext();
  const [position, setPosition] = React.useState({ x: value.s / 100, y: 1 - value.v / 100 });
  const positionRef = React.useRef(position);
  const { ref } = hooks.useMove(
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
  React.useEffect(() => {
    setPosition({ x: value.s / 100, y: 1 - value.v / 100 });
  }, [value.s, value.v]);
  const handleArrow = (event, pos) => {
    event.preventDefault();
    const _position = hooks.clampUseMovePosition(pos);
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
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ...getStyles("saturation"),
      ref,
      ...others,
      role: "slider",
      "aria-label": saturationLabel,
      "aria-valuenow": position.x,
      "aria-valuetext": converters.convertHsvaTo("rgba", value),
      tabIndex: focusable ? 0 : -1,
      onKeyDown: handleKeyDown,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...getStyles("saturationOverlay", {
              style: { backgroundColor: `hsl(${value.h}, 100%, 50%)` }
            })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...getStyles("saturationOverlay", {
              style: { backgroundImage: "linear-gradient(90deg, #fff, transparent)" }
            })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...getStyles("saturationOverlay", {
              style: { backgroundImage: "linear-gradient(0deg, #000, transparent)" }
            })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(Thumb.Thumb, { position, ...getStyles("thumb", { style: { backgroundColor: color } }) })
      ]
    }
  );
}
Saturation.displayName = "@mantine/core/Saturation";

exports.Saturation = Saturation;
//# sourceMappingURL=Saturation.cjs.map
