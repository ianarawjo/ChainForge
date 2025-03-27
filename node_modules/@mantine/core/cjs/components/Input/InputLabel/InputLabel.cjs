'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
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
var InputWrapper_context = require('../InputWrapper.context.cjs');
var Input_module = require('../Input.module.css.cjs');

const defaultProps = {
  labelElement: "label"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  label: {
    "--input-label-size": getSize.getFontSize(size),
    "--input-asterisk-color": void 0
  }
}));
const InputLabel = factory.factory((_props, ref) => {
  const props = useProps.useProps("InputLabel", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    labelElement,
    size,
    required,
    htmlFor,
    onMouseDown,
    children,
    __staticSelector,
    variant,
    mod,
    ...others
  } = useProps.useProps("InputLabel", defaultProps, props);
  const _getStyles = useStyles.useStyles({
    name: ["InputWrapper", __staticSelector],
    props,
    classes: Input_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "label",
    vars,
    varsResolver
  });
  const ctx = InputWrapper_context.useInputWrapperContext();
  const getStyles = ctx?.getStyles || _getStyles;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ...getStyles("label", ctx?.getStyles ? { className, style } : void 0),
      component: labelElement,
      variant,
      size,
      ref,
      htmlFor: labelElement === "label" ? htmlFor : void 0,
      mod: [{ required }, mod],
      onMouseDown: (event) => {
        onMouseDown?.(event);
        if (!event.defaultPrevented && event.detail > 1) {
          event.preventDefault();
        }
      },
      ...others,
      children: [
        children,
        required && /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("required"), "aria-hidden": true, children: " *" })
      ]
    }
  );
});
InputLabel.classes = Input_module;
InputLabel.displayName = "@mantine/core/InputLabel";

exports.InputLabel = InputLabel;
//# sourceMappingURL=InputLabel.cjs.map
