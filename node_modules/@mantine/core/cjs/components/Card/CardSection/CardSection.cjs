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
var Box = require('../../../core/Box/Box.cjs');
var polymorphicFactory = require('../../../core/factory/polymorphic-factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Card_context = require('../Card.context.cjs');
var Card_module = require('../Card.module.css.cjs');

const defaultProps = {};
const CardSection = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("CardSection", defaultProps, _props);
  const { classNames, className, style, styles, vars, withBorder, inheritPadding, mod, ...others } = props;
  const ctx = Card_context.useCardContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      mod: [{ "with-border": withBorder, "inherit-padding": inheritPadding }, mod],
      ...ctx.getStyles("section", { className, style, styles, classNames }),
      ...others
    }
  );
});
CardSection.classes = Card_module;
CardSection.displayName = "@mantine/core/CardSection";

exports.CardSection = CardSection;
//# sourceMappingURL=CardSection.cjs.map
