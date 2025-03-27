'use client';
import { Children } from 'react';

function filterFalsyChildren(children) {
  return Children.toArray(children).filter(Boolean);
}

export { filterFalsyChildren };
//# sourceMappingURL=filter-falsy-children.mjs.map
