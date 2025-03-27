'use client';
import { jsx } from 'react/jsx-runtime';
import { Children, cloneElement, createElement } from 'react';
import { isElement } from '../../core/utils/is-element/is-element.mjs';
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
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import classes from './Breadcrumbs.module.css.mjs';

const defaultProps = {
  separator: "/"
};
const varsResolver = createVarsResolver((_, { separatorMargin }) => ({
  root: {
    "--bc-separator-margin": getSpacing(separatorMargin)
  }
}));
const Breadcrumbs = factory((_props, ref) => {
  const props = useProps("Breadcrumbs", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    separator,
    separatorMargin,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Breadcrumbs",
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
  const items = Children.toArray(children).reduce((acc, child, index, array) => {
    const item = isElement(child) ? cloneElement(child, {
      ...getStyles("breadcrumb", { className: child.props?.className }),
      key: index
    }) : /* @__PURE__ */ createElement("div", { ...getStyles("breadcrumb"), key: index }, child);
    acc.push(item);
    if (index !== array.length - 1) {
      acc.push(
        /* @__PURE__ */ createElement(Box, { ...getStyles("separator"), key: `separator-${index}` }, separator)
      );
    }
    return acc;
  }, []);
  return /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root"), ...others, children: items });
});
Breadcrumbs.classes = classes;
Breadcrumbs.displayName = "@mantine/core/Breadcrumbs";

export { Breadcrumbs };
//# sourceMappingURL=Breadcrumbs.mjs.map
