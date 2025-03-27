'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
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
import { useRandomClassName } from '../../core/Box/use-random-classname/use-random-classname.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { GridProvider } from './Grid.context.mjs';
import { GridCol } from './GridCol/GridCol.mjs';
import { GridVariables } from './GridVariables.mjs';
import classes from './Grid.module.css.mjs';

const defaultProps = {
  gutter: "md",
  grow: false,
  columns: 12
};
const varsResolver = createVarsResolver((_, { justify, align, overflow }) => ({
  root: {
    "--grid-justify": justify,
    "--grid-align": align,
    "--grid-overflow": overflow
  }
}));
const Grid = factory((_props, ref) => {
  const props = useProps("Grid", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    grow,
    gutter,
    columns,
    align,
    justify,
    children,
    breakpoints,
    type,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Grid",
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
  const responsiveClassName = useRandomClassName();
  if (type === "container" && breakpoints) {
    return /* @__PURE__ */ jsxs(GridProvider, { value: { getStyles, grow, columns: columns || 12, breakpoints, type }, children: [
      /* @__PURE__ */ jsx(GridVariables, { selector: `.${responsiveClassName}`, ...props }),
      /* @__PURE__ */ jsx("div", { ...getStyles("container"), children: /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others, children: /* @__PURE__ */ jsx("div", { ...getStyles("inner"), children }) }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(GridProvider, { value: { getStyles, grow, columns: columns || 12, breakpoints, type }, children: [
    /* @__PURE__ */ jsx(GridVariables, { selector: `.${responsiveClassName}`, ...props }),
    /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others, children: /* @__PURE__ */ jsx("div", { ...getStyles("inner"), children }) })
  ] });
});
Grid.classes = classes;
Grid.displayName = "@mantine/core/Grid";
Grid.Col = GridCol;

export { Grid };
//# sourceMappingURL=Grid.mjs.map
