'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var createPolymorphicComponent = require('../../../core/factory/create-polymorphic-component.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Pagination_context = require('../Pagination.context.cjs');
var Pagination_icons = require('../Pagination.icons.cjs');
var PaginationControl = require('../PaginationControl/PaginationControl.cjs');

function createEdgeComponent({ icon, name, action, type }) {
  const defaultProps = { icon };
  const Component = React.forwardRef((props, ref) => {
    const { icon: _icon, ...others } = useProps.useProps(name, defaultProps, props);
    const Icon = _icon;
    const ctx = Pagination_context.usePaginationContext();
    const disabled = type === "next" ? ctx.active === ctx.total : ctx.active === 1;
    return /* @__PURE__ */ jsxRuntime.jsx(
      PaginationControl.PaginationControl,
      {
        disabled: ctx.disabled || disabled,
        ref,
        onClick: ctx[action],
        withPadding: false,
        ...others,
        children: /* @__PURE__ */ jsxRuntime.jsx(
          Icon,
          {
            className: "mantine-rotate-rtl",
            style: {
              width: "calc(var(--pagination-control-size) / 1.8)",
              height: "calc(var(--pagination-control-size) / 1.8)"
            }
          }
        )
      }
    );
  });
  Component.displayName = `@mantine/core/${name}`;
  return createPolymorphicComponent.createPolymorphicComponent(Component);
}
const PaginationNext = createEdgeComponent({
  icon: Pagination_icons.PaginationNextIcon,
  name: "PaginationNext",
  action: "onNext",
  type: "next"
});
const PaginationPrevious = createEdgeComponent({
  icon: Pagination_icons.PaginationPreviousIcon,
  name: "PaginationPrevious",
  action: "onPrevious",
  type: "previous"
});
const PaginationFirst = createEdgeComponent({
  icon: Pagination_icons.PaginationFirstIcon,
  name: "PaginationFirst",
  action: "onFirst",
  type: "previous"
});
const PaginationLast = createEdgeComponent({
  icon: Pagination_icons.PaginationLastIcon,
  name: "PaginationLast",
  action: "onLast",
  type: "next"
});

exports.PaginationFirst = PaginationFirst;
exports.PaginationLast = PaginationLast;
exports.PaginationNext = PaginationNext;
exports.PaginationPrevious = PaginationPrevious;
exports.createEdgeComponent = createEdgeComponent;
//# sourceMappingURL=PaginationEdges.cjs.map
