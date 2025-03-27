'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { parseThemeColor } from '../../core/MantineProvider/color-functions/parse-theme-color/parse-theme-color.mjs';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { rgba } from '../../core/MantineProvider/color-functions/rgba/rgba.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './Blockquote.module.css.mjs';

const defaultProps = {
  iconSize: 48
};
const varsResolver = createVarsResolver((theme, { color, iconSize, radius }) => {
  const darkParsed = parseThemeColor({
    color: color || theme.primaryColor,
    theme,
    colorScheme: "dark"
  });
  const lightParsed = parseThemeColor({
    color: color || theme.primaryColor,
    theme,
    colorScheme: "light"
  });
  return {
    root: {
      "--bq-bg-light": rgba(lightParsed.value, 0.07),
      "--bq-bg-dark": rgba(darkParsed.value, 0.06),
      "--bq-bd": getThemeColor(color, theme),
      "--bq-icon-size": rem(iconSize),
      "--bq-radius": getRadius(radius)
    }
  };
});
const Blockquote = factory((_props, ref) => {
  const props = useProps("Blockquote", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    icon,
    iconSize,
    cite,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Blockquote",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxs(Box, { component: "blockquote", ref, ...getStyles("root"), ...others, children: [
    icon && /* @__PURE__ */ jsx("span", { ...getStyles("icon"), children: icon }),
    children,
    cite && /* @__PURE__ */ jsx("cite", { ...getStyles("cite"), children: cite })
  ] });
});
Blockquote.classes = classes;
Blockquote.displayName = "@mantine/core/Blockquote";

export { Blockquote };
//# sourceMappingURL=Blockquote.mjs.map
