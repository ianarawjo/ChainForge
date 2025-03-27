'use client';
import { jsx } from 'react/jsx-runtime';
import { NumericFormat } from 'react-number-format';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const defaultProps = {};
function NumberFormatter(_props) {
  const props = useProps("NumberFormatter", defaultProps, _props);
  const { value, defaultValue, ...others } = props;
  if (value === void 0) {
    return null;
  }
  return /* @__PURE__ */ jsx(NumericFormat, { displayType: "text", value, ...others });
}
const extendNumberFormatter = (c) => c;
NumberFormatter.extend = extendNumberFormatter;
NumberFormatter.displayName = "@mantine/core/NumberFormatter";

export { NumberFormatter };
//# sourceMappingURL=NumberFormatter.mjs.map
