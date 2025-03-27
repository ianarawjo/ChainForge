'use client';
'use strict';

var React = require('react');

function useValidatedState(initialValue, validation, initialValidationState) {
  const [value, setValue] = React.useState(initialValue);
  const [lastValidValue, setLastValidValue] = React.useState(
    validation(initialValue) ? initialValue : void 0
  );
  const [valid, setValid] = React.useState(
    typeof initialValidationState === "boolean" ? initialValidationState : validation(initialValue)
  );
  const onChange = (val) => {
    if (validation(val)) {
      setLastValidValue(val);
      setValid(true);
    } else {
      setValid(false);
    }
    setValue(val);
  };
  return [{ value, lastValidValue, valid }, onChange];
}

exports.useValidatedState = useValidatedState;
//# sourceMappingURL=use-validated-state.cjs.map
