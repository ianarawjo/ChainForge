'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var rem = require('../../../core/utils/units-converters/rem.cjs');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
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
var InputDescription = require('../InputDescription/InputDescription.cjs');
var InputError = require('../InputError/InputError.cjs');
var InputLabel = require('../InputLabel/InputLabel.cjs');
var InputWrapper_context = require('../InputWrapper.context.cjs');
var getInputOffsets = require('./get-input-offsets/get-input-offsets.cjs');
var Input_module = require('../Input.module.css.cjs');

const defaultProps = {
  labelElement: "label",
  inputContainer: (children) => children,
  inputWrapperOrder: ["label", "description", "input", "error"]
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  label: {
    "--input-label-size": getSize.getFontSize(size),
    "--input-asterisk-color": void 0
  },
  error: {
    "--input-error-size": size === void 0 ? void 0 : `calc(${getSize.getFontSize(size)} - ${rem.rem(2)})`
  },
  description: {
    "--input-description-size": size === void 0 ? void 0 : `calc(${getSize.getFontSize(size)} - ${rem.rem(2)})`
  }
}));
const InputWrapper = factory.factory((_props, ref) => {
  const props = useProps.useProps("InputWrapper", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    size,
    variant,
    __staticSelector,
    inputContainer,
    inputWrapperOrder,
    label,
    error,
    description,
    labelProps,
    descriptionProps,
    errorProps,
    labelElement,
    children,
    withAsterisk,
    id,
    required,
    __stylesApiProps,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: ["InputWrapper", __staticSelector],
    props: __stylesApiProps || props,
    classes: Input_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const sharedProps = {
    size,
    variant,
    __staticSelector
  };
  const idBase = hooks.useId(id);
  const isRequired = typeof withAsterisk === "boolean" ? withAsterisk : required;
  const errorId = errorProps?.id || `${idBase}-error`;
  const descriptionId = descriptionProps?.id || `${idBase}-description`;
  const inputId = idBase;
  const hasError = !!error && typeof error !== "boolean";
  const hasDescription = !!description;
  const _describedBy = `${hasError ? errorId : ""} ${hasDescription ? descriptionId : ""}`;
  const describedBy = _describedBy.trim().length > 0 ? _describedBy.trim() : void 0;
  const labelId = labelProps?.id || `${idBase}-label`;
  const _label = label && /* @__PURE__ */ jsxRuntime.jsx(
    InputLabel.InputLabel,
    {
      labelElement,
      id: labelId,
      htmlFor: inputId,
      required: isRequired,
      ...sharedProps,
      ...labelProps,
      children: label
    },
    "label"
  );
  const _description = hasDescription && /* @__PURE__ */ jsxRuntime.jsx(
    InputDescription.InputDescription,
    {
      ...descriptionProps,
      ...sharedProps,
      size: descriptionProps?.size || sharedProps.size,
      id: descriptionProps?.id || descriptionId,
      children: description
    },
    "description"
  );
  const _input = /* @__PURE__ */ jsxRuntime.jsx(React.Fragment, { children: inputContainer(children) }, "input");
  const _error = hasError && /* @__PURE__ */ React.createElement(
    InputError.InputError,
    {
      ...errorProps,
      ...sharedProps,
      size: errorProps?.size || sharedProps.size,
      key: "error",
      id: errorProps?.id || errorId
    },
    error
  );
  const content = inputWrapperOrder.map((part) => {
    switch (part) {
      case "label":
        return _label;
      case "input":
        return _input;
      case "description":
        return _description;
      case "error":
        return _error;
      default:
        return null;
    }
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    InputWrapper_context.InputWrapperProvider,
    {
      value: {
        getStyles,
        describedBy,
        inputId,
        labelId,
        ...getInputOffsets.getInputOffsets(inputWrapperOrder, { hasDescription, hasError })
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Box.Box,
        {
          ref,
          variant,
          size,
          mod: [{ error: !!error }, mod],
          ...getStyles("root"),
          ...others,
          children: content
        }
      )
    }
  );
});
InputWrapper.classes = Input_module;
InputWrapper.displayName = "@mantine/core/InputWrapper";

exports.InputWrapper = InputWrapper;
//# sourceMappingURL=InputWrapper.cjs.map
