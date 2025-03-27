'use client';
import { jsx } from 'react/jsx-runtime';
import { createElement } from 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useSliderContext } from '../Slider.context.mjs';
import { getPosition } from '../utils/get-position/get-position.mjs';
import { isMarkFilled } from './is-mark-filled.mjs';

function Marks({ marks, min, max, disabled, value, offset, inverted }) {
  const { getStyles } = useSliderContext();
  if (!marks) {
    return null;
  }
  const items = marks.map((mark, index) => /* @__PURE__ */ createElement(
    Box,
    {
      ...getStyles("markWrapper"),
      __vars: { "--mark-offset": `${getPosition({ value: mark.value, min, max })}%` },
      key: index
    },
    /* @__PURE__ */ jsx(
      Box,
      {
        ...getStyles("mark"),
        mod: { filled: isMarkFilled({ mark, value, offset, inverted }), disabled }
      }
    ),
    mark.label && /* @__PURE__ */ jsx("div", { ...getStyles("markLabel"), children: mark.label })
  ));
  return /* @__PURE__ */ jsx("div", { children: items });
}
Marks.displayName = "@mantine/core/SliderMarks";

export { Marks };
//# sourceMappingURL=Marks.mjs.map
