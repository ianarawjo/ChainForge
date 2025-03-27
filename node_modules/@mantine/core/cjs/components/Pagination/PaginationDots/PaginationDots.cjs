'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Pagination_context = require('../Pagination.context.cjs');
var Pagination_icons = require('../Pagination.icons.cjs');
var Pagination_module = require('../Pagination.module.css.cjs');

const defaultProps = {
  icon: Pagination_icons.PaginationDotsIcon
};
const PaginationDots = factory.factory((_props, ref) => {
  const props = useProps.useProps("PaginationDots", defaultProps, _props);
  const { classNames, className, style, styles, vars, icon, ...others } = props;
  const ctx = Pagination_context.usePaginationContext();
  const Icon = icon;
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...ctx.getStyles("dots", { className, style, styles, classNames }), ...others, children: /* @__PURE__ */ jsxRuntime.jsx(
    Icon,
    {
      style: {
        width: "calc(var(--pagination-control-size) / 1.8)",
        height: "calc(var(--pagination-control-size) / 1.8)"
      }
    }
  ) });
});
PaginationDots.classes = Pagination_module;
PaginationDots.displayName = "@mantine/core/PaginationDots";

exports.PaginationDots = PaginationDots;
//# sourceMappingURL=PaginationDots.cjs.map
