'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../../core/factory/polymorphic-factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useCardContext } from '../Card.context.mjs';
import classes from '../Card.module.css.mjs';

const defaultProps = {};
const CardSection = polymorphicFactory((_props, ref) => {
  const props = useProps("CardSection", defaultProps, _props);
  const { classNames, className, style, styles, vars, withBorder, inheritPadding, mod, ...others } = props;
  const ctx = useCardContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      mod: [{ "with-border": withBorder, "inherit-padding": inheritPadding }, mod],
      ...ctx.getStyles("section", { className, style, styles, classNames }),
      ...others
    }
  );
});
CardSection.classes = classes;
CardSection.displayName = "@mantine/core/CardSection";

export { CardSection };
//# sourceMappingURL=CardSection.mjs.map
