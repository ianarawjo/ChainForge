'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var ChipGroup_context = require('../ChipGroup.context.cjs');

const defaultProps = {};
function ChipGroup(props) {
  const { value, defaultValue, onChange, multiple, children } = useProps.useProps(
    "ChipGroup",
    defaultProps,
    props
  );
  const [_value, setValue] = hooks.useUncontrolled({
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
  return /* @__PURE__ */ jsxRuntime.jsx(ChipGroup_context.ChipGroupProvider, { value: { isChipSelected, onChange: handleChange, multiple }, children });
}
ChipGroup.displayName = "@mantine/core/ChipGroup";

exports.ChipGroup = ChipGroup;
//# sourceMappingURL=ChipGroup.cjs.map
