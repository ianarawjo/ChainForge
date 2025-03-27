'use client';
'use strict';

var filterProps = require('../../../../utils/filter-props/filter-props.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');

function mergeVars(vars) {
  return vars.reduce((acc, current) => {
    if (current) {
      Object.keys(current).forEach((key) => {
        acc[key] = { ...acc[key], ...filterProps.filterProps(current[key]) };
      });
    }
    return acc;
  }, {});
}

exports.mergeVars = mergeVars;
//# sourceMappingURL=merge-vars.cjs.map
