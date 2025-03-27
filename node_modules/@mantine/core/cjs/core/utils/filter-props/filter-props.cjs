'use client';
'use strict';

function filterProps(props) {
  return Object.keys(props).reduce((acc, key) => {
    if (props[key] !== void 0) {
      acc[key] = props[key];
    }
    return acc;
  }, {});
}

exports.filterProps = filterProps;
//# sourceMappingURL=filter-props.cjs.map
