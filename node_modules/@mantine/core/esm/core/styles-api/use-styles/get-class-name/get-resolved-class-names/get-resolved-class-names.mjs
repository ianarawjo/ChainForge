'use client';
import { resolveClassNames } from '../resolve-class-names/resolve-class-names.mjs';

function getResolvedClassNames({
  selector,
  stylesCtx,
  theme,
  classNames,
  props
}) {
  return resolveClassNames({ theme, classNames, props, stylesCtx })[selector];
}

export { getResolvedClassNames };
//# sourceMappingURL=get-resolved-class-names.mjs.map
