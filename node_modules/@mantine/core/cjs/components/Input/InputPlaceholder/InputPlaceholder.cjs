'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
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
var Input_module = require('../Input.module.css.cjs');

const defaultProps = {};
const InputPlaceholder = factory.factory((_props, ref) => {
  const props = useProps.useProps("InputPlaceholder", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    __staticSelector,
    variant,
    error,
    mod,
    ...others
  } = useProps.useProps("InputPlaceholder", defaultProps, props);
  const getStyles = useStyles.useStyles({
    name: ["InputPlaceholder", __staticSelector],
    props,
    classes: Input_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "placeholder"
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getStyles("placeholder"),
      mod: [{ error: !!error }, mod],
      component: "span",
      variant,
      ref,
      ...others
    }
  );
});
InputPlaceholder.classes = Input_module;
InputPlaceholder.displayName = "@mantine/core/InputPlaceholder";

exports.InputPlaceholder = InputPlaceholder;
//# sourceMappingURL=InputPlaceholder.cjs.map
