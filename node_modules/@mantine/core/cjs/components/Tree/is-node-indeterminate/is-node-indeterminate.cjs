'use client';
'use strict';

require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var memoize = require('../../../core/utils/memoize/memoize.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var getAllCheckedNodes = require('../get-all-checked-nodes/get-all-checked-nodes.cjs');

function isNodeIndeterminate(value, data, checkedState) {
  if (checkedState.length === 0) {
    return false;
  }
  const checkedNodes = getAllCheckedNodes.getAllCheckedNodes(data, checkedState).result;
  return checkedNodes.some((node) => node.value === value && node.indeterminate);
}
const memoizedIsNodeIndeterminate = memoize.memoize(isNodeIndeterminate);

exports.isNodeIndeterminate = isNodeIndeterminate;
exports.memoizedIsNodeIndeterminate = memoizedIsNodeIndeterminate;
//# sourceMappingURL=is-node-indeterminate.cjs.map
