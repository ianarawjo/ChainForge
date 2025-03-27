'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { useDirection } from '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useRatingContext } from '../Rating.context.mjs';
import { StarSymbol } from '../StarSymbol/StarSymbol.mjs';

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
  const ctx = useRatingContext();
  const _fullIcon = typeof fullIcon === "function" ? fullIcon(value) : fullIcon;
  const _emptyIcon = typeof emptyIcon === "function" ? emptyIcon(value) : emptyIcon;
  const { dir } = useDirection();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    !readOnly && /* @__PURE__ */ jsx(
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
    /* @__PURE__ */ jsx(
      Box,
      {
        component: readOnly ? "div" : "label",
        ...ctx.getStyles("label"),
        "data-read-only": readOnly || void 0,
        htmlFor: id,
        onClick: () => onChange(value),
        __vars: {
          "--rating-item-z-index": (fractionValue === 1 ? void 0 : active ? 2 : 0)?.toString()
        },
        children: /* @__PURE__ */ jsx(
          Box,
          {
            ...ctx.getStyles("symbolBody"),
            __vars: {
              "--rating-symbol-clip-path": fractionValue === 1 ? void 0 : dir === "ltr" ? `inset(0 ${active ? 100 - fractionValue * 100 : 100}% 0 0)` : `inset(0 0 0 ${active ? 100 - fractionValue * 100 : 100}% )`
            },
            children: full ? _fullIcon || /* @__PURE__ */ jsx(StarSymbol, { type: "full" }) : _emptyIcon || /* @__PURE__ */ jsx(StarSymbol, { type: "empty" })
          }
        )
      }
    )
  ] });
}
RatingItem.displayName = "@mantine/core/RatingItem";

export { RatingItem };
//# sourceMappingURL=RatingItem.mjs.map
