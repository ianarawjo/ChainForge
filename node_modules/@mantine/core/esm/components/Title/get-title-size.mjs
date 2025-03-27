'use client';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const headings = ["h1", "h2", "h3", "h4", "h5", "h6"];
const sizes = ["xs", "sm", "md", "lg", "xl"];
function getTitleSize(order, size) {
  const titleSize = size !== void 0 ? size : `h${order}`;
  if (headings.includes(titleSize)) {
    return {
      fontSize: `var(--mantine-${titleSize}-font-size)`,
      fontWeight: `var(--mantine-${titleSize}-font-weight)`,
      lineHeight: `var(--mantine-${titleSize}-line-height)`
    };
  } else if (sizes.includes(titleSize)) {
    return {
      fontSize: `var(--mantine-font-size-${titleSize})`,
      fontWeight: `var(--mantine-h${order}-font-weight)`,
      lineHeight: `var(--mantine-h${order}-line-height)`
    };
  }
  return {
    fontSize: rem(titleSize),
    fontWeight: `var(--mantine-h${order}-font-weight)`,
    lineHeight: `var(--mantine-h${order}-line-height)`
  };
}

export { getTitleSize };
//# sourceMappingURL=get-title-size.mjs.map
