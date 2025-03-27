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
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var DirectionProvider = require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Rating_context = require('../Rating.context.cjs');
var StarSymbol = require('../StarSymbol/StarSymbol.cjs');

function RatingItem({
  getSymbolLabel,
  emptyIcon,
  fullIcon,
  full,
  active,
  value,
  readOnly,
  fractionValue,
  color,
  id,
  onBlur,
  onChange,
  onInputChange,
  style,
  ...others
}) {
  const ctx = Rating_context.useRatingContext();
  const _fullIcon = typeof fullIcon === "function" ? fullIcon(value) : fullIcon;
  const _emptyIcon = typeof emptyIcon === "function" ? emptyIcon(value) : emptyIcon;
  const { dir } = DirectionProvider.useDirection();
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    !readOnly && /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        ...ctx.getStyles("input"),
        onKeyDown: (event) => event.key === " " && onChange(value),
        id,
        type: "radio",
        "data-active": active || void 0,
        "aria-label": getSymbolLabel?.(value),
        value,
        onBlur,
        onChange: onInputChange,
        ...others
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        component: readOnly ? "div" : "label",
        ...ctx.getStyles("label"),
        "data-read-only": readOnly || void 0,
        htmlFor: id,
        onClick: () => onChange(value),
        __vars: {
          "--rating-item-z-index": (fractionValue === 1 ? void 0 : active ? 2 : 0)?.toString()
        },
        children: /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            ...ctx.getStyles("symbolBody"),
            __vars: {
              "--rating-symbol-clip-path": fractionValue === 1 ? void 0 : dir === "ltr" ? `inset(0 ${active ? 100 - fractionValue * 100 : 100}% 0 0)` : `inset(0 0 0 ${active ? 100 - fractionValue * 100 : 100}% )`
            },
            children: full ? _fullIcon || /* @__PURE__ */ jsxRuntime.jsx(StarSymbol.StarSymbol, { type: "full" }) : _emptyIcon || /* @__PURE__ */ jsxRuntime.jsx(StarSymbol.StarSymbol, { type: "empty" })
          }
        )
      }
    )
  ] });
}
RatingItem.displayName = "@mantine/core/RatingItem";

exports.RatingItem = RatingItem;
//# sourceMappingURL=RatingItem.cjs.map
