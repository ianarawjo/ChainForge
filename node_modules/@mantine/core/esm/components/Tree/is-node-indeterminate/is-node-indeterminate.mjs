'use client';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import { memoize } from '../../../core/utils/memoize/memoize.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { getAllCheckedNodes } from '../get-all-checked-nodes/get-all-checked-nodes.mjs';

function isNodeIndeterminate(value, data, checkedState) {
  if (checkedState.length === 0) {
    return false;
  }
  const checkedNodes = getAllCheckedNodes(data, checkedState).result;
  return checkedNodes.some((node) => node.value === value && node.indeterminate);
}
const memoizedIsNodeIndeterminate = memoize(isNodeIndeterminate);

export { isNodeIndeterminate, memoizedIsNodeIndeterminate };
//# sourceMappingURL=is-node-indeterminate.mjs.map
