'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
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
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './Fieldset.module.css.mjs';

const defaultProps = {
  variant: "default"
};
const varsResolver = createVarsResolver((_, { radius }) => ({
  root: {
    "--fieldset-radius": radius === void 0 ? void 0 : getRadius(radius)
  }
}));
const Fieldset = factory((_props, ref) => {
  const props = useProps("Fieldset", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Fieldset",
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
  return /* @__PURE__ */ jsxs(
    Box,
    {
      component: "fieldset",
      ref,
      variant,
      ...getStyles("root", { variant }),
      ...others,
      children: [
        legend && /* @__PURE__ */ jsx("legend", { ...getStyles("legend", { variant }), children: legend }),
        children
      ]
    }
  );
});
Fieldset.classes = classes;
Fieldset.displayName = "@mantine/core/Fieldset";

export { Fieldset };
//# sourceMappingURL=Fieldset.mjs.map
