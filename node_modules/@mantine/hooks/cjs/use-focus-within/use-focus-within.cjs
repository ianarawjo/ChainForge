'use client';
'use strict';

var React = require('react');

function containsRelatedTarget(event) {
  if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof HTMLElement) {
    return event.currentTarget.contains(event.relatedTarget);
  }
  return false;
}
function useFocusWithin({
  onBlur,
  onFocus
} = {}) {
  const ref = React.useRef(null);
  const [focused, setFocused] = React.useState(false);
  const focusedRef = React.useRef(false);
  const _setFocused = (value) => {
    setFocused(value);
    focusedRef.current = value;
  };
  const handleFocusIn = (event) => {
    if (!focusedRef.current) {
      _setFocused(true);
      onFocus?.(event);
    }
  };
  const handleFocusOut = (event) => {
    if (focusedRef.current && !containsRelatedTarget(event)) {
      _setFocused(false);
      onBlur?.(event);
    }
  };
  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener("focusin", handleFocusIn);
      node.addEventListener("focusout", handleFocusOut);
      return () => {
        node?.removeEventListener("focusin", handleFocusIn);
        node?.removeEventListener("focusout", handleFocusOut);
      };
    }
    return void 0;
  }, [handleFocusIn, handleFocusOut]);
  return { ref, focused };
}

exports.useFocusWithin = useFocusWithin;
//# sourceMappingURL=use-focus-within.cjs.map
