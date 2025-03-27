'use client';
import { jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

function CheckIcon({ size, style, ...others }) {
  const _style = size !== void 0 ? { width: rem(size), height: rem(size), ...style } : style;
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 10 7",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      style: _style,
      "aria-hidden": true,
      ...others,
      children: /* @__PURE__ */ jsx(
        "path",
        {
          d: "M4 4.586L1.707 2.293A1 1 0 1 0 .293 3.707l3 3a.997.997 0 0 0 1.414 0l5-5A1 1 0 1 0 8.293.293L4 4.586z",
          fill: "currentColor",
          fillRule: "evenodd",
          clipRule: "evenodd"
        }
      )
    }
  );
}
function CheckboxIcon({ indeterminate, ...others }) {
  if (indeterminate) {
    return /* @__PURE__ */ jsx(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 32 6",
        "aria-hidden": true,
        ...others,
        children: /* @__PURE__ */ jsx("rect", { width: "32", height: "6", fill: "currentColor", rx: "3" })
      }
    );
  }
  return /* @__PURE__ */ jsx(CheckIcon, { ...others });
}

export { CheckIcon, CheckboxIcon };
//# sourceMappingURL=CheckIcon.mjs.map
