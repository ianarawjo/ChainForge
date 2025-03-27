'use client';
import React from 'react';

function getRefProp(element) {
  const version = React.version;
  if (typeof React.version !== "string") {
    return element?.ref;
  }
  if (version.startsWith("18.")) {
    return element?.ref;
  }
  return element?.props?.ref;
}

export { getRefProp };
//# sourceMappingURL=get-ref-prop.mjs.map
