'use client';
import { getThemeStyles } from './get-theme-styles/get-theme-styles.mjs';
import { resolveStyle } from './resolve-style/resolve-style.mjs';
import { resolveStyles } from './resolve-styles/resolve-styles.mjs';
import { resolveVars } from './resolve-vars/resolve-vars.mjs';

function getStyle({
  theme,
  themeName,
  selector,
  options,
  props,
  stylesCtx,
  rootSelector,
  styles,
  style,
  vars,
  varsResolver,
  headless,
  withStylesTransform
}) {
  return {
    ...!withStylesTransform && getThemeStyles({ theme, themeName, props, stylesCtx, selector }),
    ...!withStylesTransform && resolveStyles({ theme, styles, props, stylesCtx })[selector],
    ...!withStylesTransform && resolveStyles({ theme, styles: options?.styles, props: options?.props || props, stylesCtx })[selector],
    ...resolveVars({ theme, props, stylesCtx, vars, varsResolver, selector, themeName, headless }),
    ...rootSelector === selector ? resolveStyle({ style, theme }) : null,
    ...resolveStyle({ style: options?.style, theme })
  };
}

export { getStyle };
//# sourceMappingURL=get-style.mjs.map
