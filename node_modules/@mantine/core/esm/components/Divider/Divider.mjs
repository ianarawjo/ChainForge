'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
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
import classes from './Divider.module.css.mjs';

const defaultProps = {
  orientation: "horizontal"
};
const varsResolver = createVarsResolver((theme, { color, variant, size }) => ({
  root: {
    "--divider-color": color ? getThemeColor(color, theme) : void 0,
    "--divider-border-style": variant,
    "--divider-size": getSize(size, "divider-size")
  }
}));
const Divider = factory((_props, ref) => {
  const props = useProps("Divider", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    orientation,
    label,
    labelPosition,
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Divider",
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
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      mod: [{ orientation, "with-label": !!label }, mod],
      ...getStyles("root"),
      ...others,
      role: "separator",
      children: label && /* @__PURE__ */ jsx(Box, { component: "span", mod: { position: labelPosition }, ...getStyles("label"), children: label })
    }
  );
});
Divider.classes = classes;
Divider.displayName = "@mantine/core/Divider";

export { Divider };
//# sourceMappingURL=Divider.mjs.map
