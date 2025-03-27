'use client';
import { resolveClassNames } from '../resolve-class-names/resolve-class-names.mjs';

function getOptionsClassNames({
  selector,
  stylesCtx,
  options,
  props,
  theme
}) {
  return resolveClassNames({
    theme,
    classNames: options?.classNames,
    props: options?.props || props,
    stylesCtx
  })[selector];
}

export { getOptionsClassNames };
//# sourceMappingURL=get-options-class-names.mjs.map
