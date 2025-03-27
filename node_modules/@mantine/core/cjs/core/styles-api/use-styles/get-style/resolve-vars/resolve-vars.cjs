'use client';
'use strict';

var mergeVars = require('./merge-vars.cjs');

function resolveVars({
  vars,
  varsResolver,
  theme,
  props,
  stylesCtx,
  selector,
  themeName,
  headless
}) {
  return mergeVars.mergeVars([
    headless ? {} : varsResolver?.(theme, props, stylesCtx),
    ...themeName.map((name) => theme.components?.[name]?.vars?.(theme, props, stylesCtx)),
    vars?.(theme, props, stylesCtx)
  ])?.[selector];
}

exports.resolveVars = resolveVars;
//# sourceMappingURL=resolve-vars.cjs.map
