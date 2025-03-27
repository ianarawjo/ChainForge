'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import cx from 'clsx';
import 'react';
import '@mantine/hooks';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useRandomClassName } from '../../../core/Box/use-random-classname/use-random-classname.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useGridContext } from '../Grid.context.mjs';
import { GridColVariables } from './GridColVariables.mjs';
import classes from '../Grid.module.css.mjs';

const defaultProps = {
  span: 12
};
const GridCol = factory((_props, ref) => {
  const props = useProps("GridCol", defaultProps, _props);
  const { classNames, className, style, styles, vars, span, order, offset, ...others } = props;
  const ctx = useGridContext();
  const responsiveClassName = useRandomClassName();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      GridColVariables,
      {
        selector: `.${responsiveClassName}`,
        span,
        order,
        offset
      }
    ),
    /* @__PURE__ */ jsx(
      Box,
      {
        ref,
        ...ctx.getStyles("col", {
          className: cx(className, responsiveClassName),
          style,
          classNames,
          styles
        }),
        ...others
      }
    )
  ] });
});
GridCol.classes = classes;
GridCol.displayName = "@mantine/core/GridCol";

export { GridCol };
//# sourceMappingURL=GridCol.mjs.map
