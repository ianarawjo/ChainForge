'use client';
import { jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getSpacing } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
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
import { TableTd, TableTh, TableTr, TableThead, TableTbody, TableTfoot, TableCaption } from './Table.components.mjs';
import { TableProvider } from './Table.context.mjs';
import { TableDataRenderer } from './TableDataRenderer.mjs';
import { TableScrollContainer } from './TableScrollContainer.mjs';
import classes from './Table.module.css.mjs';

const defaultProps = {
  withRowBorders: true,
  verticalSpacing: 7
};
const varsResolver = createVarsResolver(
  (theme, {
    layout,
    captionSide,
    horizontalSpacing,
    verticalSpacing,
    borderColor,
    stripedColor,
    highlightOnHoverColor,
    striped,
    highlightOnHover,
    stickyHeaderOffset,
    stickyHeader
  }) => ({
    table: {
      "--table-layout": layout,
      "--table-caption-side": captionSide,
      "--table-horizontal-spacing": getSpacing(horizontalSpacing),
      "--table-vertical-spacing": getSpacing(verticalSpacing),
      "--table-border-color": borderColor ? getThemeColor(borderColor, theme) : void 0,
      "--table-striped-color": striped && stripedColor ? getThemeColor(stripedColor, theme) : void 0,
      "--table-highlight-on-hover-color": highlightOnHover && highlightOnHoverColor ? getThemeColor(highlightOnHoverColor, theme) : void 0,
      "--table-sticky-header-offset": stickyHeader ? rem(stickyHeaderOffset) : void 0
    }
  })
);
const Table = factory((_props, ref) => {
  const props = useProps("Table", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    horizontalSpacing,
    verticalSpacing,
    captionSide,
    stripedColor,
    highlightOnHoverColor,
    striped,
    highlightOnHover,
    withColumnBorders,
    withRowBorders,
    withTableBorder,
    borderColor,
    layout,
    variant,
    data,
    children,
    stickyHeader,
    stickyHeaderOffset,
    mod,
    tabularNums,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Table",
    props,
    className,
    style,
    classes,
    classNames,
    styles,
    unstyled,
    rootSelector: "table",
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsx(
    TableProvider,
    {
      value: {
        getStyles,
        stickyHeader,
        striped: striped === true ? "odd" : striped || void 0,
        highlightOnHover,
        withColumnBorders,
        withRowBorders,
        captionSide: captionSide || "bottom"
      },
      children: /* @__PURE__ */ jsx(
        Box,
        {
          component: "table",
          variant,
          ref,
          mod: [{ "data-with-table-border": withTableBorder, "data-tabular-nums": tabularNums }, mod],
          ...getStyles("table"),
          ...others,
          children: children || !!data && /* @__PURE__ */ jsx(TableDataRenderer, { data })
        }
      )
    }
  );
});
Table.classes = classes;
Table.displayName = "@mantine/core/Table";
Table.Td = TableTd;
Table.Th = TableTh;
Table.Tr = TableTr;
Table.Thead = TableThead;
Table.Tbody = TableTbody;
Table.Tfoot = TableTfoot;
Table.Caption = TableCaption;
Table.ScrollContainer = TableScrollContainer;
Table.DataRenderer = TableDataRenderer;

export { Table };
//# sourceMappingURL=Table.mjs.map
