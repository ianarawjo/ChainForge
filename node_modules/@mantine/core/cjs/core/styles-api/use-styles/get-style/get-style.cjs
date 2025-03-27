'use client';
'use strict';

var getThemeStyles = require('./get-theme-styles/get-theme-styles.cjs');
var resolveStyle = require('./resolve-style/resolve-style.cjs');
var resolveStyles = require('./resolve-styles/resolve-styles.cjs');
var resolveVars = require('./resolve-vars/resolve-vars.cjs');

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
    ...!withStylesTransform && getThemeStyles.getThemeStyles({ theme, themeName, props, stylesCtx, selector }),
    ...!withStylesTransform && resolveStyles.resolveStyles({ theme, styles, props, stylesCtx })[selector],
    ...!withStylesTransform && resolveStyles.resolveStyles({ theme, styles: options?.styles, props: options?.props || props, stylesCtx })[selector],
    ...resolveVars.resolveVars({ theme, props, stylesCtx, vars, varsResolver, selector, themeName, headless }),
    ...rootSelector === selector ? resolveStyle.resolveStyle({ style, theme }) : null,
    ...resolveStyle.resolveStyle({ style: options?.style, theme })
  };
}

exports.getStyle = getStyle;
//# sourceMappingURL=get-style.cjs.map
