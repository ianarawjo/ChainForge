'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
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
import { SimpleGridContainerVariables, SimpleGridMediaVariables } from './SimpleGridVariables.mjs';
import classes from './SimpleGrid.module.css.mjs';

const defaultProps = {
  cols: 1,
  spacing: "md",
  type: "media"
};
const SimpleGrid = factory((_props, ref) => {
  const props = useProps("SimpleGrid", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    cols,
    verticalSpacing,
    spacing,
    type,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "SimpleGrid",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars
  });
  const responsiveClassName = useRandomClassName();
  if (type === "container") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(SimpleGridContainerVariables, { ...props, selector: `.${responsiveClassName}` }),
      /* @__PURE__ */ jsx("div", { ...getStyles("container"), children: /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SimpleGridMediaVariables, { ...props, selector: `.${responsiveClassName}` }),
    /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root", { className: responsiveClassName }), ...others })
  ] });
});
SimpleGrid.classes = classes;
SimpleGrid.displayName = "@mantine/core/SimpleGrid";

export { SimpleGrid };
//# sourceMappingURL=SimpleGrid.mjs.map
