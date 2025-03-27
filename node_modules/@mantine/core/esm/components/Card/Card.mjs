'use client';
import { jsx } from 'react/jsx-runtime';
import { Children, cloneElement } from 'react';
import { getSpacing } from '../../core/utils/get-size/get-size.mjs';
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
import '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Paper } from '../Paper/Paper.mjs';
import { CardProvider } from './Card.context.mjs';
import { CardSection } from './CardSection/CardSection.mjs';
import classes from './Card.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { padding }) => ({
  root: {
    "--card-padding": getSpacing(padding)
  }
}));
const Card = polymorphicFactory((_props, ref) => {
  const props = useProps("Card", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, children, padding, ...others } = props;
  const getStyles = useStyles({
    name: "Card",
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
  const _children = Children.toArray(children);
  const content = _children.map((child, index) => {
    if (typeof child === "object" && child && "type" in child && child.type === CardSection) {
      return cloneElement(child, {
        "data-first-section": index === 0 || void 0,
        "data-last-section": index === _children.length - 1 || void 0
      });
    }
    return child;
  });
  return /* @__PURE__ */ jsx(CardProvider, { value: { getStyles }, children: /* @__PURE__ */ jsx(Paper, { ref, unstyled, ...getStyles("root"), ...others, children: content }) });
});
Card.classes = classes;
Card.displayName = "@mantine/core/Card";
Card.Section = CardSection;

export { Card };
//# sourceMappingURL=Card.mjs.map
