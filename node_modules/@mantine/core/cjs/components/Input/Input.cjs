'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var extractStyleProps = require('../../core/Box/style-props/extract-style-props/extract-style-props.cjs');
var Box = require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Input_context = require('./Input.context.cjs');
var InputClearButton = require('./InputClearButton/InputClearButton.cjs');
var InputDescription = require('./InputDescription/InputDescription.cjs');
var InputError = require('./InputError/InputError.cjs');
var InputLabel = require('./InputLabel/InputLabel.cjs');
var InputPlaceholder = require('./InputPlaceholder/InputPlaceholder.cjs');
var InputWrapper_context = require('./InputWrapper.context.cjs');
var InputWrapper = require('./InputWrapper/InputWrapper.cjs');
var Input_module = require('./Input.module.css.cjs');

const defaultProps = {
  variant: "default",
  leftSectionPointerEvents: "none",
  rightSectionPointerEvents: "none",
  withAria: true,
  withErrorStyles: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, props, ctx) => ({
  wrapper: {
    "--input-margin-top": ctx.offsetTop ? "calc(var(--mantine-spacing-xs) / 2)" : void 0,
    "--input-margin-bottom": ctx.offsetBottom ? "calc(var(--mantine-spacing-xs) / 2)" : void 0,
    "--input-height": getSize.getSize(props.size, "input-height"),
    "--input-fz": getSize.getFontSize(props.size),
    "--input-radius": props.radius === void 0 ? void 0 : getSize.getRadius(props.radius),
    "--input-left-section-width": props.leftSectionWidth !== void 0 ? rem.rem(props.leftSectionWidth) : void 0,
    "--input-right-section-width": props.rightSectionWidth !== void 0 ? rem.rem(props.rightSectionWidth) : void 0,
    "--input-padding-y": props.multiline ? getSize.getSize(props.size, "input-padding-y") : void 0,
    "--input-left-section-pointer-events": props.leftSectionPointerEvents,
    "--input-right-section-pointer-events": props.rightSectionPointerEvents
  }
}));
const Input = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Input", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    required,
    __staticSelector,
    __stylesApiProps,
    size,
    wrapperProps,
    error,
    disabled,
    leftSection,
    leftSectionProps,
    leftSectionWidth,
    rightSection,
    rightSectionProps,
    rightSectionWidth,
    rightSectionPointerEvents,
    leftSectionPointerEvents,
    variant,
    vars,
    pointer,
    multiline,
    radius,
    id,
    withAria,
    withErrorStyles,
    mod,
    inputSize,
    __clearSection,
    __clearable,
    __defaultRightSection,
    ...others
  } = props;
  const { styleProps, rest } = extractStyleProps.extractStyleProps(others);
  const ctx = InputWrapper_context.useInputWrapperContext();
  const stylesCtx = { offsetBottom: ctx?.offsetBottom, offsetTop: ctx?.offsetTop };
  const getStyles = useStyles.useStyles({
    name: ["Input", __staticSelector],
    props: __stylesApiProps || props,
    classes: Input_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    stylesCtx,
    rootSelector: "wrapper",
    vars,
    varsResolver
  });
  const ariaAttributes = withAria ? {
    required,
    disabled,
    "aria-invalid": !!error,
    "aria-describedby": ctx?.describedBy,
    id: ctx?.inputId || id
  } : {};
  const _rightSection = rightSection || __clearable && __clearSection || __defaultRightSection;
  return /* @__PURE__ */ jsxRuntime.jsx(Input_context.InputContext, { value: { size: size || "sm" }, children: /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ...getStyles("wrapper"),
      ...styleProps,
      ...wrapperProps,
      mod: [
        {
          error: !!error && withErrorStyles,
          pointer,
          disabled,
          multiline,
          "data-with-right-section": !!_rightSection,
          "data-with-left-section": !!leftSection
        },
        mod
      ],
      variant,
      size,
      children: [
        leftSection && /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...leftSectionProps,
            "data-position": "left",
            ...getStyles("section", {
              className: leftSectionProps?.className,
              style: leftSectionProps?.style
            }),
            children: leftSection
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            component: "input",
            ...rest,
            ...ariaAttributes,
            ref,
            required,
            mod: { disabled, error: !!error && withErrorStyles },
            variant,
            __size: inputSize,
            ...getStyles("input")
          }
        ),
        _rightSection && /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...rightSectionProps,
            "data-position": "right",
            ...getStyles("section", {
              className: rightSectionProps?.className,
              style: rightSectionProps?.style
            }),
            children: _rightSection
          }
        )
      ]
    }
  ) });
});
Input.classes = Input_module;
Input.Wrapper = InputWrapper.InputWrapper;
Input.Label = InputLabel.InputLabel;
Input.Error = InputError.InputError;
Input.Description = InputDescription.InputDescription;
Input.Placeholder = InputPlaceholder.InputPlaceholder;
Input.ClearButton = InputClearButton.InputClearButton;
Input.displayName = "@mantine/core/Input";

exports.Input = Input;
//# sourceMappingURL=Input.cjs.map
