'use client';
import { jsx } from 'react/jsx-runtime';
import { useRatingContext } from '../Rating.context.mjs';
import { StarIcon } from './StarIcon.mjs';

function StarSymbol({ type }) {
  const ctx = useRatingContext();
  return /* @__PURE__ */ jsx(StarIcon, { ...ctx.getStyles("starSymbol"), "data-filled": type === "full" || void 0 });
}
StarSymbol.displayName = "@mantine/core/StarSymbol";

export { StarSymbol };
//# sourceMappingURL=StarSymbol.mjs.map
