'use client';
import { useState } from 'react';

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
  const [value, setValue] = useState(initialState);
  return [value, getInputOnChange(setValue)];
}

export { getInputOnChange, useInputState };
//# sourceMappingURL=use-input-state.mjs.map
