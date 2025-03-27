'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var isElement = require('../../core/utils/is-element/is-element.cjs');
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
var Breadcrumbs_module = require('./Breadcrumbs.module.css.cjs');

const defaultProps = {
  separator: "/"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { separatorMargin }) => ({
  root: {
    "--bc-separator-margin": getSize.getSpacing(separatorMargin)
  }
}));
const Breadcrumbs = factory.factory((_props, ref) => {
  const props = useProps.useProps("Breadcrumbs", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    separator,
    separatorMargin,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Breadcrumbs",
    classes: Breadcrumbs_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const items = React.Children.toArray(children).reduce((acc, child, index, array) => {
    const item = isElement.isElement(child) ? React.cloneElement(child, {
      ...getStyles("breadcrumb", { className: child.props?.className }),
      key: index
    }) : /* @__PURE__ */ React.createElement("div", { ...getStyles("breadcrumb"), key: index }, child);
    acc.push(item);
    if (index !== array.length - 1) {
      acc.push(
        /* @__PURE__ */ React.createElement(Box.Box, { ...getStyles("separator"), key: `separator-${index}` }, separator)
      );
    }
    return acc;
  }, []);
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others, children: items });
});
Breadcrumbs.classes = Breadcrumbs_module;
Breadcrumbs.displayName = "@mantine/core/Breadcrumbs";

exports.Breadcrumbs = Breadcrumbs;
//# sourceMappingURL=Breadcrumbs.cjs.map
