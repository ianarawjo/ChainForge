'use client';
'use strict';

var React = require('react');

function filterFalsyChildren(children) {
  return React.Children.toArray(children).filter(Boolean);
}

exports.filterFalsyChildren = filterFalsyChildren;
//# sourceMappingURL=filter-falsy-children.cjs.map
