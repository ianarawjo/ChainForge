'use client';
import { jsx, Fragment } from 'react/jsx-runtime';
import { usePaginationContext } from '../Pagination.context.mjs';
import { PaginationControl } from '../PaginationControl/PaginationControl.mjs';
import { PaginationDots } from '../PaginationDots/PaginationDots.mjs';

function PaginationItems({ dotsIcon }) {
  const ctx = usePaginationContext();
  const items = ctx.range.map((page, index) => {
    if (page === "dots") {
      return /* @__PURE__ */ jsx(PaginationDots, { icon: dotsIcon }, index);
    }
    return /* @__PURE__ */ jsx(
      PaginationControl,
      {
        active: page === ctx.active,
        "aria-current": page === ctx.active ? "page" : void 0,
        onClick: () => ctx.onChange(page),
        disabled: ctx.disabled,
        ...ctx.getItemProps?.(page),
        children: ctx.getItemProps?.(page)?.children ?? page
      },
      index
    );
  });
  return /* @__PURE__ */ jsx(Fragment, { children: items });
}
PaginationItems.displayName = "@mantine/core/PaginationItems";

export { PaginationItems };
//# sourceMappingURL=PaginationItems.mjs.map
