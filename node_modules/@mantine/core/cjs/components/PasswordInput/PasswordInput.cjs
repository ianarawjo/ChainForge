'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var cx = require('clsx');
var hooks = require('@mantine/hooks');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
var useResolvedStylesApi = require('../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var extractStyleProps = require('../../core/Box/style-props/extract-style-props/extract-style-props.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var ActionIcon = require('../ActionIcon/ActionIcon.cjs');
require('../ActionIcon/ActionIconGroup/ActionIconGroup.cjs');
require('../ActionIcon/ActionIconGroupSection/ActionIconGroupSection.cjs');
var Input = require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
require('../Input/InputWrapper.context.cjs');
var InputBase = require('../InputBase/InputBase.cjs');
var PasswordToggleIcon = require('./PasswordToggleIcon.cjs');
var PasswordInput_module = require('./PasswordInput.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const defaultProps = {
  visibilityToggleIcon: PasswordToggleIcon.PasswordToggleIcon
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  root: {
    "--psi-icon-size": getSize.getSize(size, "psi-icon-size"),
    "--psi-button-size": getSize.getSize(size, "psi-button-size")
  }
}));
const PasswordInput = factory.factory((_props, ref) => {
  const props = useProps.useProps("PasswordInput", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    required,
    error,
    leftSection,
    disabled,
    id,
    variant,
    inputContainer,
    description,
    label,
    size,
    errorProps,
    descriptionProps,
    labelProps,
    withAsterisk,
    inputWrapperOrder,
    wrapperProps,
    radius,
    rightSection,
    rightSectionWidth,
    rightSectionPointerEvents,
    leftSectionWidth,
    visible,
    defaultVisible,
    onVisibilityChange,
    visibilityToggleIcon,
    visibilityToggleButtonProps,
    rightSectionProps,
    leftSectionProps,
    leftSectionPointerEvents,
    withErrorStyles,
    mod,
    ...others
  } = props;
  const uuid = hooks.useId(id);
  const [_visible, setVisibility] = hooks.useUncontrolled({
    value: visible,
    defaultValue: defaultVisible,
    finalValue: false,
    onChange: onVisibilityChange
  });
  const toggleVisibility = () => setVisibility(!_visible);
  const getStyles = useStyles.useStyles({
    name: "PasswordInput",
    classes: PasswordInput_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const { styleProps, rest } = extractStyleProps.extractStyleProps(others);
  const VisibilityToggleIcon = visibilityToggleIcon;
  const visibilityToggleButton = /* @__PURE__ */ jsxRuntime.jsx(
    ActionIcon.ActionIcon,
    {
      ...getStyles("visibilityToggle"),
      disabled,
      radius,
      "aria-hidden": !visibilityToggleButtonProps,
      tabIndex: -1,
      ...visibilityToggleButtonProps,
      variant: visibilityToggleButtonProps?.variant ?? "subtle",
      color: "gray",
      unstyled,
      onTouchEnd: (event) => {
        event.preventDefault();
        visibilityToggleButtonProps?.onTouchEnd?.(event);
        toggleVisibility();
      },
      onMouseDown: (event) => {
        event.preventDefault();
        visibilityToggleButtonProps?.onMouseDown?.(event);
        toggleVisibility();
      },
      onKeyDown: (event) => {
        visibilityToggleButtonProps?.onKeyDown?.(event);
        if (event.key === " ") {
          event.preventDefault();
          toggleVisibility();
        }
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(VisibilityToggleIcon, { reveal: _visible })
    }
  );
  return /* @__PURE__ */ jsxRuntime.jsx(
    Input.Input.Wrapper,
    {
      required,
      id: uuid,
      label,
      error,
      description,
      size,
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      __staticSelector: "PasswordInput",
      errorProps,
      descriptionProps,
      unstyled,
      withAsterisk,
      inputWrapperOrder,
      inputContainer,
      variant,
      labelProps: { ...labelProps, htmlFor: uuid },
      mod,
      ...getStyles("root"),
      ...styleProps,
      ...wrapperProps,
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Input.Input,
        {
          component: "div",
          error,
          leftSection,
          size,
          classNames: { ...resolvedClassNames, input: cx__default.default(PasswordInput_module.input, resolvedClassNames.input) },
          styles: resolvedStyles,
          radius,
          disabled,
          __staticSelector: "PasswordInput",
          rightSectionWidth,
          rightSection: rightSection ?? visibilityToggleButton,
          variant,
          unstyled,
          leftSectionWidth,
          rightSectionPointerEvents: rightSectionPointerEvents || "all",
          rightSectionProps,
          leftSectionProps,
          leftSectionPointerEvents,
          withAria: false,
          withErrorStyles,
          children: /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              required,
              "data-invalid": !!error || void 0,
              "data-with-left-section": !!leftSection || void 0,
              ...getStyles("innerInput"),
              disabled,
              id: uuid,
              ref,
              ...rest,
              autoComplete: rest.autoComplete || "off",
              type: _visible ? "text" : "password"
            }
          )
        }
      )
    }
  );
});
PasswordInput.classes = { ...InputBase.InputBase.classes, ...PasswordInput_module };
PasswordInput.displayName = "@mantine/core/PasswordInput";

exports.PasswordInput = PasswordInput;
//# sourceMappingURL=PasswordInput.cjs.map
