'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { filterProps } from '../../core/utils/filter-props/filter-props.mjs';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { InlineStyles } from '../../core/InlineStyles/InlineStyles.mjs';
import { parseStyleProps } from '../../core/Box/style-props/parse-style-props/parse-style-props.mjs';
import { useRandomClassName } from '../../core/Box/use-random-classname/use-random-classname.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { FLEX_STYLE_PROPS_DATA } from './flex-props.mjs';
import classes from './Flex.module.css.mjs';

const defaultProps = {};
const Flex = polymorphicFactory((_props, ref) => {
  const props = useProps("Flex", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Flex",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars
  });
  const theme = useMantineTheme();
  const responsiveClassName = useRandomClassName();
  const parsedStyleProps = parseStyleProps({
    styleProps: { gap, rowGap, columnGap, align, justify, wrap, direction },
    theme,
    data: FLEX_STYLE_PROPS_DATA
  });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    parsedStyleProps.hasResponsiveStyles && /* @__PURE__ */ jsx(
      InlineStyles,
      {
        selector: `.${responsiveClassName}`,
        styles: parsedStyleProps.styles,
        media: parsedStyleProps.media
      }
    ),
    /* @__PURE__ */ jsx(
      Box,
      {
        ref,
        ...getStyles("root", {
          className: responsiveClassName,
          style: filterProps(parsedStyleProps.inlineStyles)
        }),
        ...others
      }
    )
  ] });
});
Flex.classes = classes;
Flex.displayName = "@mantine/core/Flex";

export { Flex };
//# sourceMappingURL=Flex.mjs.map
