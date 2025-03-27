'use client';
'use strict';

var React = require('react');

function useClipboard({ timeout = 2e3 } = {}) {
  const [error, setError] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [copyTimeout, setCopyTimeout] = React.useState(null);
  const handleCopyResult = (value) => {
    window.clearTimeout(copyTimeout);
    setCopyTimeout(window.setTimeout(() => setCopied(false), timeout));
    setCopied(value);
  };
  const copy = (valueToCopy) => {
    if ("clipboard" in navigator) {
      navigator.clipboard.writeText(valueToCopy).then(() => handleCopyResult(true)).catch((err) => setError(err));
    } else {
      setError(new Error("useClipboard: navigator.clipboard is not supported"));
    }
  };
  const reset = () => {
    setCopied(false);
    setError(null);
    window.clearTimeout(copyTimeout);
  };
  return { copy, reset, error, copied };
}

exports.useClipboard = useClipboard;
//# sourceMappingURL=use-clipboard.cjs.map
