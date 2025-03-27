'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var filterProps = require('../../core/utils/filter-props/filter-props.cjs');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var InlineStyles = require('../../core/InlineStyles/InlineStyles.cjs');
var parseStyleProps = require('../../core/Box/style-props/parse-style-props/parse-style-props.cjs');
var useRandomClassname = require('../../core/Box/use-random-classname/use-random-classname.cjs');
var Box = require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var flexProps = require('./flex-props.cjs');
var Flex_module = require('./Flex.module.css.cjs');

const defaultProps = {};
const Flex = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Flex", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    gap,
    rowGap,
    columnGap,
    align,
    justify,
    wrap,
    direction,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Flex",
    classes: Flex_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars
  });
  const theme = MantineThemeProvider.useMantineTheme();
  const responsiveClassName = useRandomClassname.useRandomClassName();
  const parsedStyleProps = parseStyleProps.parseStyleProps({
    styleProps: { gap, rowGap, columnGap, align, justify, wrap, direction },
    theme,
    data: flexProps.FLEX_STYLE_PROPS_DATA
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    parsedStyleProps.hasResponsiveStyles && /* @__PURE__ */ jsxRuntime.jsx(
      InlineStyles.InlineStyles,
      {
        selector: `.${responsiveClassName}`,
        styles: parsedStyleProps.styles,
        media: parsedStyleProps.media
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ref,
        ...getStyles("root", {
          className: responsiveClassName,
          style: filterProps.filterProps(parsedStyleProps.inlineStyles)
        }),
        ...others
      }
    )
  ] });
});
Flex.classes = Flex_module;
Flex.displayName = "@mantine/core/Flex";

exports.Flex = Flex;
//# sourceMappingURL=Flex.cjs.map
