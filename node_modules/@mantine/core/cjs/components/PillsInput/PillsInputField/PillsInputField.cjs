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
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
require('../../Input/Input.cjs');
require('../../Input/InputWrapper/InputWrapper.cjs');
require('../../Input/InputDescription/InputDescription.cjs');
require('../../Input/InputError/InputError.cjs');
require('../../Input/InputLabel/InputLabel.cjs');
require('../../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../../Input/InputClearButton/InputClearButton.cjs');
var InputWrapper_context = require('../../Input/InputWrapper.context.cjs');
var PillsInput_context = require('../PillsInput.context.cjs');
var PillsInput_module = require('../PillsInput.module.css.cjs');

const defaultProps = {
  type: "visible"
};
const PillsInputField = factory.factory((_props, ref) => {
  const props = useProps.useProps("PillsInputField", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    type,
    disabled,
    id,
    pointer,
    mod,
    ...others
  } = props;
  const ctx = PillsInput_context.usePillsInputContext();
  const inputWrapperCtx = InputWrapper_context.useInputWrapperContext();
  const getStyles = useStyles.useStyles({
    name: "PillsInputField",
    classes: PillsInput_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "field"
  });
  const _disabled = disabled || ctx?.disabled;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "input",
      ref: hooks.useMergedRef(ref, ctx?.fieldRef),
      "data-type": type,
      disabled: _disabled,
      mod: [{ disabled: _disabled, pointer }, mod],
      ...getStyles("field"),
      ...others,
      id: inputWrapperCtx?.inputId || id,
      "aria-invalid": ctx?.hasError,
      "aria-describedby": inputWrapperCtx?.describedBy,
      type: "text",
      onMouseDown: (event) => !pointer && event.stopPropagation()
    }
  );
});
PillsInputField.classes = PillsInput_module;
PillsInputField.displayName = "@mantine/core/PillsInputField";

exports.PillsInputField = PillsInputField;
//# sourceMappingURL=PillsInputField.cjs.map
