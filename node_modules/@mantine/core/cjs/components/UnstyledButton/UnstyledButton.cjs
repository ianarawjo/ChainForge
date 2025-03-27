'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton_module = require('./UnstyledButton.module.css.cjs');

const defaultProps = {
  __staticSelector: "UnstyledButton"
};
const UnstyledButton = polymorphicFactory.polymorphicFactory(
  (_props, ref) => {
    const props = useProps.useProps("UnstyledButton", defaultProps, _props);
    const {
      className,
      component = "button",
      __staticSelector,
      unstyled,
      classNames,
      styles,
      style,
      ...others
    } = props;
    const getStyles = useStyles.useStyles({
      name: __staticSelector,
      props,
      classes: UnstyledButton_module,
      className,
      style,
      classNames,
      styles,
      unstyled
    });
    return /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ...getStyles("root", { focusable: true }),
        component,
        ref,
        type: component === "button" ? "button" : void 0,
        ...others
      }
    );
  }
);
UnstyledButton.classes = UnstyledButton_module;
UnstyledButton.displayName = "@mantine/core/UnstyledButton";

exports.UnstyledButton = UnstyledButton;
//# sourceMappingURL=UnstyledButton.cjs.map
