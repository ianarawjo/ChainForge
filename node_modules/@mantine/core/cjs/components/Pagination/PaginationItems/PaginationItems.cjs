'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Pagination_context = require('../Pagination.context.cjs');
var PaginationControl = require('../PaginationControl/PaginationControl.cjs');
var PaginationDots = require('../PaginationDots/PaginationDots.cjs');

function PaginationItems({ dotsIcon }) {
  const ctx = Pagination_context.usePaginationContext();
  const items = ctx.range.map((page, index) => {
    if (page === "dots") {
      return /* @__PURE__ */ jsxRuntime.jsx(PaginationDots.PaginationDots, { icon: dotsIcon }, index);
    }
    return /* @__PURE__ */ jsxRuntime.jsx(
      PaginationControl.PaginationControl,
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
  return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: items });
}
PaginationItems.displayName = "@mantine/core/PaginationItems";

exports.PaginationItems = PaginationItems;
//# sourceMappingURL=PaginationItems.cjs.map
