'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { createPolymorphicComponent } from '../../../core/factory/create-polymorphic-component.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { usePaginationContext } from '../Pagination.context.mjs';
import { PaginationNextIcon, PaginationPreviousIcon, PaginationFirstIcon, PaginationLastIcon } from '../Pagination.icons.mjs';
import { PaginationControl } from '../PaginationControl/PaginationControl.mjs';

function createEdgeComponent({ icon, name, action, type }) {
  const defaultProps = { icon };
  const Component = forwardRef((props, ref) => {
    const { icon: _icon, ...others } = useProps(name, defaultProps, props);
    const Icon = _icon;
    const ctx = usePaginationContext();
    const disabled = type === "next" ? ctx.active === ctx.total : ctx.active === 1;
    return /* @__PURE__ */ jsx(
      PaginationControl,
      {
        disabled: ctx.disabled || disabled,
        ref,
        onClick: ctx[action],
        withPadding: false,
        ...others,
        children: /* @__PURE__ */ jsx(
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
  return createPolymorphicComponent(Component);
}
const PaginationNext = createEdgeComponent({
  icon: PaginationNextIcon,
  name: "PaginationNext",
  action: "onNext",
  type: "next"
});
const PaginationPrevious = createEdgeComponent({
  icon: PaginationPreviousIcon,
  name: "PaginationPrevious",
  action: "onPrevious",
  type: "previous"
});
const PaginationFirst = createEdgeComponent({
  icon: PaginationFirstIcon,
  name: "PaginationFirst",
  action: "onFirst",
  type: "previous"
});
const PaginationLast = createEdgeComponent({
  icon: PaginationLastIcon,
  name: "PaginationLast",
  action: "onLast",
  type: "next"
});

export { PaginationFirst, PaginationLast, PaginationNext, PaginationPrevious, createEdgeComponent };
//# sourceMappingURL=PaginationEdges.mjs.map
