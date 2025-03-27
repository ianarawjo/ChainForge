'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
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
import { getTitleSize } from './get-title-size.mjs';
import classes from './Title.module.css.mjs';

const defaultProps = {
  order: 1
};
const varsResolver = createVarsResolver((_, { order, size, lineClamp, textWrap }) => {
  const sizeVariables = getTitleSize(order, size);
  return {
    root: {
      "--title-fw": sizeVariables.fontWeight,
      "--title-lh": sizeVariables.lineHeight,
      "--title-fz": sizeVariables.fontSize,
      "--title-line-clamp": typeof lineClamp === "number" ? lineClamp.toString() : void 0,
      "--title-text-wrap": textWrap
    }
  };
});
const Title = factory((_props, ref) => {
  const props = useProps("Title", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    order,
    vars,
    size,
    variant,
    lineClamp,
    textWrap,
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Title",
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
  if (![1, 2, 3, 4, 5, 6].includes(order)) {
    return null;
  }
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...getStyles("root"),
      component: `h${order}`,
      variant,
      ref,
      mod: [{ order, "data-line-clamp": typeof lineClamp === "number" }, mod],
      size,
      ...others
    }
  );
});
Title.classes = classes;
Title.displayName = "@mantine/core/Title";

export { Title };
//# sourceMappingURL=Title.mjs.map
