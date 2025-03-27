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

function isNodeChecked(value, data, checkedState) {
  if (checkedState.length === 0) {
    return false;
  }
  if (checkedState.includes(value)) {
    return true;
  }
  const checkedNodes = getAllCheckedNodes.getAllCheckedNodes(data, checkedState).result;
  return checkedNodes.some((node) => node.value === value && node.checked);
}
const memoizedIsNodeChecked = memoize.memoize(isNodeChecked);

exports.isNodeChecked = isNodeChecked;
exports.memoizedIsNodeChecked = memoizedIsNodeChecked;
//# sourceMappingURL=is-node-checked.cjs.map
