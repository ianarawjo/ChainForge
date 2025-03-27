'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { usePaginationContext } from '../Pagination.context.mjs';
import { PaginationDotsIcon } from '../Pagination.icons.mjs';
import classes from '../Pagination.module.css.mjs';

const defaultProps = {
  icon: PaginationDotsIcon
};
const PaginationDots = factory((_props, ref) => {
  const props = useProps("PaginationDots", defaultProps, _props);
  const { classNames, className, style, styles, vars, icon, ...others } = props;
  const ctx = usePaginationContext();
  const Icon = icon;
  return /* @__PURE__ */ jsx(Box, { ref, ...ctx.getStyles("dots", { className, style, styles, classNames }), ...others, children: /* @__PURE__ */ jsx(
    Icon,
    {
      style: {
        width: "calc(var(--pagination-control-size) / 1.8)",
        height: "calc(var(--pagination-control-size) / 1.8)"
      }
    }
  ) });
});
PaginationDots.classes = classes;
PaginationDots.displayName = "@mantine/core/PaginationDots";

export { PaginationDots };
//# sourceMappingURL=PaginationDots.mjs.map
