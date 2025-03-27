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

function RadioIcon({ size, style, ...others }) {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 5 5",
      style: { width: rem.rem(size), height: rem.rem(size), ...style },
      "aria-hidden": true,
      ...others,
      children: /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "2.5", cy: "2.5", r: "2.5", fill: "currentColor" })
    }
  );
}

exports.RadioIcon = RadioIcon;
//# sourceMappingURL=RadioIcon.cjs.map
