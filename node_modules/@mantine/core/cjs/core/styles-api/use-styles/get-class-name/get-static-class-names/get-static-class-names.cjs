'use client';
'use strict';

function getStaticClassNames({
  themeName,
  classNamesPrefix,
  selector,
  withStaticClass
}) {
  if (withStaticClass === false) {
    return [];
  }
  return themeName.map((n) => `${classNamesPrefix}-${n}-${selector}`);
}

exports.getStaticClassNames = getStaticClassNames;
//# sourceMappingURL=get-static-class-names.cjs.map
