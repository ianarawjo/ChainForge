'use client';
import { rem } from '../../../core/utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';

function getPositionVariables(_position = "top-end", offset = 0) {
  const variables = {
    "--indicator-top": void 0,
    "--indicator-bottom": void 0,
    "--indicator-left": void 0,
    "--indicator-right": void 0,
    "--indicator-translate-x": void 0,
    "--indicator-translate-y": void 0
  };
  const _offset = rem(offset);
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

export { getPositionVariables };
//# sourceMappingURL=get-position-variables.mjs.map
