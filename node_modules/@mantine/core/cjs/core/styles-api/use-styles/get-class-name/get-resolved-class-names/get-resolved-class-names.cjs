'use client';
'use strict';

var resolveClassNames = require('../resolve-class-names/resolve-class-names.cjs');

function getResolvedClassNames({
  selector,
  stylesCtx,
  theme,
  classNames,
  props
}) {
  return resolveClassNames.resolveClassNames({ theme, classNames, props, stylesCtx })[selector];
}

exports.getResolvedClassNames = getResolvedClassNames;
//# sourceMappingURL=get-resolved-class-names.cjs.map
