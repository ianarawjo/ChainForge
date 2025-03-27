'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
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
require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Paper = require('../Paper/Paper.cjs');
var Card_context = require('./Card.context.cjs');
var CardSection = require('./CardSection/CardSection.cjs');
var Card_module = require('./Card.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { padding }) => ({
  root: {
    "--card-padding": getSize.getSpacing(padding)
  }
}));
const Card = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Card", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, children, padding, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "Card",
    props,
    classes: Card_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const _children = React.Children.toArray(children);
  const content = _children.map((child, index) => {
    if (typeof child === "object" && child && "type" in child && child.type === CardSection.CardSection) {
      return React.cloneElement(child, {
        "data-first-section": index === 0 || void 0,
        "data-last-section": index === _children.length - 1 || void 0
      });
    }
    return child;
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Card_context.CardProvider, { value: { getStyles }, children: /* @__PURE__ */ jsxRuntime.jsx(Paper.Paper, { ref, unstyled, ...getStyles("root"), ...others, children: content }) });
});
Card.classes = Card_module;
Card.displayName = "@mantine/core/Card";
Card.Section = CardSection.CardSection;

exports.Card = Card;
//# sourceMappingURL=Card.cjs.map
