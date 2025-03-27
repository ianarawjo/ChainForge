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
var ColorSwatch = require('../../ColorSwatch/ColorSwatch.cjs');
var ColorPicker_context = require('../ColorPicker.context.cjs');

const Swatches = React.forwardRef(
  ({
    className,
    datatype,
    setValue,
    onChangeEnd,
    size,
    focusable,
    data,
    swatchesPerRow,
    ...others
  }, ref) => {
    const ctx = ColorPicker_context.useColorPickerContext();
    const colors = data.map((color, index) => /* @__PURE__ */ React.createElement(
      ColorSwatch.ColorSwatch,
      {
        ...ctx.getStyles("swatch"),
        unstyled: ctx.unstyled,
        component: "button",
        type: "button",
        color,
        key: index,
        radius: "sm",
        onClick: () => {
          setValue(color);
          onChangeEnd?.(color);
        },
        "aria-label": color,
        tabIndex: focusable ? 0 : -1,
        "data-swatch": true
      }
    ));
    return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...ctx.getStyles("swatches"), ref, ...others, children: colors });
  }
);
Swatches.displayName = "@mantine/core/Swatches";

exports.Swatches = Swatches;
//# sourceMappingURL=Swatches.cjs.map
