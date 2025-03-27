'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../../core/utils/units-converters/rem.cjs');
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

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  description: {
    "--input-description-size": size === void 0 ? void 0 : `calc(${getSize.getFontSize(size)} - ${rem.rem(2)})`
  }
}));
const InputDescription = factory.factory((_props, ref) => {
  const props = useProps.useProps("InputDescription", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    size,
    __staticSelector,
    __inheritStyles = true,
    variant,
    ...others
  } = useProps.useProps("InputDescription", defaultProps, props);
  const ctx = InputWrapper_context.useInputWrapperContext();
  const _getStyles = useStyles.useStyles({
    name: ["InputWrapper", __staticSelector],
    props,
    classes: Input_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "description",
    vars,
    varsResolver
  });
  const getStyles = __inheritStyles && ctx?.getStyles || _getStyles;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "p",
      ref,
      variant,
      size,
      ...getStyles("description", ctx?.getStyles ? { className, style } : void 0),
      ...others
    }
  );
});
InputDescription.classes = Input_module;
InputDescription.displayName = "@mantine/core/InputDescription";

exports.InputDescription = InputDescription;
//# sourceMappingURL=InputDescription.cjs.map
