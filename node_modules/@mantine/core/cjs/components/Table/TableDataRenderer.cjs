'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var Table_components = require('./Table.components.cjs');

function TableDataRenderer({ data }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    data.caption && /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableCaption, { children: data.caption }),
    data.head && /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableThead, { children: /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTr, { children: data.head.map((item, index) => /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTh, { children: item }, index)) }) }),
    data.body && /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTbody, { children: data.body.map((row, rowIndex) => /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTr, { children: row.map((item, index) => /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTd, { children: item }, index)) }, rowIndex)) }),
    data.foot && /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTfoot, { children: /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTr, { children: data.foot.map((item, index) => /* @__PURE__ */ jsxRuntime.jsx(Table_components.TableTh, { children: item }, index)) }) })
  ] });
}
TableDataRenderer.displayName = "@mantine/core/TableDataRenderer";

exports.TableDataRenderer = TableDataRenderer;
//# sourceMappingURL=TableDataRenderer.cjs.map
