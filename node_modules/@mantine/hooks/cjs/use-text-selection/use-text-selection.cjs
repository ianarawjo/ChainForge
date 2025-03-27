'use client';
'use strict';

var React = require('react');
var useForceUpdate = require('../use-force-update/use-force-update.cjs');

function useTextSelection() {
  const forceUpdate = useForceUpdate.useForceUpdate();
  const [selection, setSelection] = React.useState(null);
  const handleSelectionChange = () => {
    setSelection(document.getSelection());
    forceUpdate();
  };
  React.useEffect(() => {
    setSelection(document.getSelection());
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);
  return selection;
}

exports.useTextSelection = useTextSelection;
//# sourceMappingURL=use-text-selection.cjs.map
