'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './ColorSwatch.module.css.mjs';

const defaultProps = {
  withShadow: true
};
const varsResolver = createVarsResolver((_, { radius, size }) => ({
  root: {
    "--cs-radius": radius === void 0 ? void 0 : getRadius(radius),
    "--cs-size": rem(size)
  }
}));
const ColorSwatch = polymorphicFactory((_props, ref) => {
  const props = useProps("ColorSwatch", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    size,
    radius,
    withShadow,
    children,
    variant,
    ...others
  } = useProps("ColorSwatch", defaultProps, props);
  const getStyles = useStyles({
    name: "ColorSwatch",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ref,
      variant,
      size,
      ...getStyles("root", { focusable: true }),
      ...others,
      children: [
        /* @__PURE__ */ jsx("span", { ...getStyles("alphaOverlay") }),
        withShadow && /* @__PURE__ */ jsx("span", { ...getStyles("shadowOverlay") }),
        /* @__PURE__ */ jsx("span", { ...getStyles("colorOverlay", { style: { backgroundColor: color } }) }),
        /* @__PURE__ */ jsx("span", { ...getStyles("childrenOverlay"), children })
      ]
    }
  );
});
ColorSwatch.classes = classes;
ColorSwatch.displayName = "@mantine/core/ColorSwatch";

export { ColorSwatch };
//# sourceMappingURL=ColorSwatch.mjs.map
