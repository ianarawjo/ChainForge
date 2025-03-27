'use client';
'use strict';

var resolveClassNames = require('../resolve-class-names/resolve-class-names.cjs');

function getOptionsClassNames({
  selector,
  stylesCtx,
  options,
  props,
  theme
}) {
  return resolveClassNames.resolveClassNames({
    theme,
    classNames: options?.classNames,
    props: options?.props || props,
    stylesCtx
  })[selector];
}

exports.getOptionsClassNames = getOptionsClassNames;
//# sourceMappingURL=get-options-class-names.cjs.map
