'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { TableCaption, TableThead, TableTr, TableTh, TableTbody, TableTd, TableTfoot } from './Table.components.mjs';

function TableDataRenderer({ data }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    data.caption && /* @__PURE__ */ jsx(TableCaption, { children: data.caption }),
    data.head && /* @__PURE__ */ jsx(TableThead, { children: /* @__PURE__ */ jsx(TableTr, { children: data.head.map((item, index) => /* @__PURE__ */ jsx(TableTh, { children: item }, index)) }) }),
    data.body && /* @__PURE__ */ jsx(TableTbody, { children: data.body.map((row, rowIndex) => /* @__PURE__ */ jsx(TableTr, { children: row.map((item, index) => /* @__PURE__ */ jsx(TableTd, { children: item }, index)) }, rowIndex)) }),
    data.foot && /* @__PURE__ */ jsx(TableTfoot, { children: /* @__PURE__ */ jsx(TableTr, { children: data.foot.map((item, index) => /* @__PURE__ */ jsx(TableTh, { children: item }, index)) }) })
  ] });
}
TableDataRenderer.displayName = "@mantine/core/TableDataRenderer";

export { TableDataRenderer };
//# sourceMappingURL=TableDataRenderer.mjs.map
