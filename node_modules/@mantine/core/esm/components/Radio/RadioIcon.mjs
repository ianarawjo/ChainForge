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

function RadioIcon({ size, style, ...others }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 5 5",
      style: { width: rem(size), height: rem(size), ...style },
      "aria-hidden": true,
      ...others,
      children: /* @__PURE__ */ jsx("circle", { cx: "2.5", cy: "2.5", r: "2.5", fill: "currentColor" })
    }
  );
}

export { RadioIcon };
//# sourceMappingURL=RadioIcon.mjs.map
