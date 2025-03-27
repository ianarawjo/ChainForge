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
var Slider_context = require('../Slider.context.cjs');
var getPosition = require('../utils/get-position/get-position.cjs');
var isMarkFilled = require('./is-mark-filled.cjs');

function Marks({ marks, min, max, disabled, value, offset, inverted }) {
  const { getStyles } = Slider_context.useSliderContext();
  if (!marks) {
    return null;
  }
  const items = marks.map((mark, index) => /* @__PURE__ */ React.createElement(
    Box.Box,
    {
      ...getStyles("markWrapper"),
      __vars: { "--mark-offset": `${getPosition.getPosition({ value: mark.value, min, max })}%` },
      key: index
    },
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ...getStyles("mark"),
        mod: { filled: isMarkFilled.isMarkFilled({ mark, value, offset, inverted }), disabled }
      }
    ),
    mark.label && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("markLabel"), children: mark.label })
  ));
  return /* @__PURE__ */ jsxRuntime.jsx("div", { children: items });
}
Marks.displayName = "@mantine/core/SliderMarks";

exports.Marks = Marks;
//# sourceMappingURL=Marks.cjs.map
