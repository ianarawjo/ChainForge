'use client';
import { jsx } from 'react/jsx-runtime';
import { useUncontrolled } from '@mantine/hooks';
import 'react';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { ChipGroupProvider } from '../ChipGroup.context.mjs';

const defaultProps = {};
function ChipGroup(props) {
  const { value, defaultValue, onChange, multiple, children } = useProps(
    "ChipGroup",
    defaultProps,
    props
  );
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: multiple ? [] : null,
    onChange
  });
  const isChipSelected = (val) => Array.isArray(_value) ? _value.includes(val) : val === _value;
  const handleChange = (event) => {
    const val = event.currentTarget.value;
    if (Array.isArray(_value)) {
      setValue(_value.includes(val) ? _value.filter((v) => v !== val) : [..._value, val]);
    } else {
      setValue(val);
    }
  };
  return /* @__PURE__ */ jsx(ChipGroupProvider, { value: { isChipSelected, onChange: handleChange, multiple }, children });
}
ChipGroup.displayName = "@mantine/core/ChipGroup";

export { ChipGroup };
//# sourceMappingURL=ChipGroup.mjs.map
