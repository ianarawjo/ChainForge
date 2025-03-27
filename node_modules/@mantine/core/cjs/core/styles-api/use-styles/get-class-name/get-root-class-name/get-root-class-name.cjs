'use client';
'use strict';

function getRootClassName({ rootSelector, selector, className }) {
  return rootSelector === selector ? className : void 0;
}

exports.getRootClassName = getRootClassName;
//# sourceMappingURL=get-root-class-name.cjs.map
