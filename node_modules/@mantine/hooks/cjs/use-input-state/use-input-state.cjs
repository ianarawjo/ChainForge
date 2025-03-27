'use client';
'use strict';

var React = require('react');

function getInputOnChange(setValue) {
  return (val) => {
    if (!val) {
      setValue(val);
    } else if (typeof val === "function") {
      setValue(val);
    } else if (typeof val === "object" && "nativeEvent" in val) {
      const { currentTarget } = val;
      if (currentTarget.type === "checkbox") {
        setValue(currentTarget.checked);
      } else {
        setValue(currentTarget.value);
      }
    } else {
      setValue(val);
    }
  };
}
function useInputState(initialState) {
  const [value, setValue] = React.useState(initialState);
  return [value, getInputOnChange(setValue)];
}

exports.getInputOnChange = getInputOnChange;
exports.useInputState = useInputState;
//# sourceMappingURL=use-input-state.cjs.map
