'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
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
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Fieldset_module = require('./Fieldset.module.css.cjs');

const defaultProps = {
  variant: "default"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius }) => ({
  root: {
    "--fieldset-radius": radius === void 0 ? void 0 : getSize.getRadius(radius)
  }
}));
const Fieldset = factory.factory((_props, ref) => {
  const props = useProps.useProps("Fieldset", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    legend,
    variant,
    children,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Fieldset",
    classes: Fieldset_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      component: "fieldset",
      ref,
      variant,
      ...getStyles("root", { variant }),
      ...others,
      children: [
        legend && /* @__PURE__ */ jsxRuntime.jsx("legend", { ...getStyles("legend", { variant }), children: legend }),
        children
      ]
    }
  );
});
Fieldset.classes = Fieldset_module;
Fieldset.displayName = "@mantine/core/Fieldset";

exports.Fieldset = Fieldset;
//# sourceMappingURL=Fieldset.cjs.map
