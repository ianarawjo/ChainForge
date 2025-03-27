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

const Thumb = React.forwardRef(({ position, ...others }, ref) => /* @__PURE__ */ jsxRuntime.jsx(
  Box.Box,
  {
    ref,
    __vars: {
      "--thumb-y-offset": `${position.y * 100}%`,
      "--thumb-x-offset": `${position.x * 100}%`
    },
    ...others
  }
));
Thumb.displayName = "@mantine/core/ColorPickerThumb";

exports.Thumb = Thumb;
//# sourceMappingURL=Thumb.cjs.map
