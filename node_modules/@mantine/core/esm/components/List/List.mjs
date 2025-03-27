'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getFontSize, getLineHeight, getSpacing } from '../../core/utils/get-size/get-size.mjs';
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
import { ListProvider } from './List.context.mjs';
import { ListItem } from './ListItem/ListItem.mjs';
import classes from './List.module.css.mjs';

const defaultProps = {
  type: "unordered"
};
const varsResolver = createVarsResolver((_, { size, spacing }) => ({
  root: {
    "--list-fz": getFontSize(size),
    "--list-lh": getLineHeight(size),
    "--list-spacing": getSpacing(spacing)
  }
}));
const List = factory((_props, ref) => {
  const props = useProps("List", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    type,
    withPadding,
    icon,
    spacing,
    center,
    listStyleType,
    mod,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "List",
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
  return /* @__PURE__ */ jsx(ListProvider, { value: { center, icon, getStyles }, children: /* @__PURE__ */ jsx(
    Box,
    {
      ...getStyles("root", { style: { listStyleType } }),
      component: type === "unordered" ? "ul" : "ol",
      mod: [{ "with-padding": withPadding }, mod],
      ref,
      ...others,
      children
    }
  ) });
});
List.classes = classes;
List.displayName = "@mantine/core/List";
List.Item = ListItem;

export { List };
//# sourceMappingURL=List.mjs.map
