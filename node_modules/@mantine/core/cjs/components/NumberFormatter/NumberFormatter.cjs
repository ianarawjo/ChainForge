'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var reactNumberFormat = require('react-number-format');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

const defaultProps = {};
function NumberFormatter(_props) {
  const props = useProps.useProps("NumberFormatter", defaultProps, _props);
  const { value, defaultValue, ...others } = props;
  if (value === void 0) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx(reactNumberFormat.NumericFormat, { displayType: "text", value, ...others });
}
const extendNumberFormatter = (c) => c;
NumberFormatter.extend = extendNumberFormatter;
NumberFormatter.displayName = "@mantine/core/NumberFormatter";

exports.NumberFormatter = NumberFormatter;
//# sourceMappingURL=NumberFormatter.cjs.map
