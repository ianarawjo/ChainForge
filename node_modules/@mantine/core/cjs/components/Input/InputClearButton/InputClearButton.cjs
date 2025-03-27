'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
var useResolvedStylesApi = require('../../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
require('../../CloseButton/CloseIcon.cjs');
var CloseButton = require('../../CloseButton/CloseButton.cjs');
var Input_context = require('../Input.context.cjs');

const defaultProps = {};
const InputClearButton = factory.factory((_props, ref) => {
  const props = useProps.useProps("InputClearButton", defaultProps, _props);
  const { size, variant, vars, classNames, styles, ...others } = props;
  const ctx = Input_context.useInputContext();
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    CloseButton.CloseButton,
    {
      variant: variant || "transparent",
      ref,
      size: size || ctx?.size || "sm",
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      __staticSelector: "InputClearButton",
      ...others
    }
  );
});
InputClearButton.displayName = "@mantine/core/InputClearButton";

exports.InputClearButton = InputClearButton;
//# sourceMappingURL=InputClearButton.cjs.map
