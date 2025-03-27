'use client';
'use strict';

var rem = require('../../../core/utils/units-converters/rem.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');

function getPositionVariables(_position = "top-end", offset = 0) {
  const variables = {
    "--indicator-top": void 0,
    "--indicator-bottom": void 0,
    "--indicator-left": void 0,
    "--indicator-right": void 0,
    "--indicator-translate-x": void 0,
    "--indicator-translate-y": void 0
  };
  const _offset = rem.rem(offset);
  const [position, placement] = _position.split("-");
  if (position === "top") {
    variables["--indicator-top"] = _offset;
    variables["--indicator-translate-y"] = "-50%";
  }
  if (position === "middle") {
    variables["--indicator-top"] = "50%";
    variables["--indicator-translate-y"] = "-50%";
  }
  if (position === "bottom") {
    variables["--indicator-bottom"] = _offset;
    variables["--indicator-translate-y"] = "50%";
  }
  if (placement === "start") {
    variables["--indicator-left"] = _offset;
    variables["--indicator-translate-x"] = "-50%";
  }
  if (placement === "center") {
    variables["--indicator-left"] = "50%";
    variables["--indicator-translate-x"] = "-50%";
  }
  if (placement === "end") {
    variables["--indicator-right"] = _offset;
    variables["--indicator-translate-x"] = "50%";
  }
  return variables;
}

exports.getPositionVariables = getPositionVariables;
//# sourceMappingURL=get-position-variables.cjs.map
