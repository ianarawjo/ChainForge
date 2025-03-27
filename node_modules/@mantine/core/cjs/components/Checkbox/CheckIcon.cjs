'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

function CheckIcon({ size, style, ...others }) {
  const _style = size !== void 0 ? { width: rem.rem(size), height: rem.rem(size), ...style } : style;
  return /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      viewBox: "0 0 10 7",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      style: _style,
      "aria-hidden": true,
      ...others,
      children: /* @__PURE__ */ jsxRuntime.jsx(
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
    return /* @__PURE__ */ jsxRuntime.jsx(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 32 6",
        "aria-hidden": true,
        ...others,
        children: /* @__PURE__ */ jsxRuntime.jsx("rect", { width: "32", height: "6", fill: "currentColor", rx: "3" })
      }
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsx(CheckIcon, { ...others });
}

exports.CheckIcon = CheckIcon;
exports.CheckboxIcon = CheckboxIcon;
//# sourceMappingURL=CheckIcon.cjs.map
