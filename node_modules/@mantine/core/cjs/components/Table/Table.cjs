'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Table_components = require('./Table.components.cjs');
var Table_context = require('./Table.context.cjs');
var TableDataRenderer = require('./TableDataRenderer.cjs');
var TableScrollContainer = require('./TableScrollContainer.cjs');
var Table_module = require('./Table.module.css.cjs');

const defaultProps = {
  withRowBorders: true,
  verticalSpacing: 7
};
const varsResolver = createVarsResolver.createVarsResolver(
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
      "--table-horizontal-spacing": getSize.getSpacing(horizontalSpacing),
      "--table-vertical-spacing": getSize.getSpacing(verticalSpacing),
      "--table-border-color": borderColor ? getThemeColor.getThemeColor(borderColor, theme) : void 0,
      "--table-striped-color": striped && stripedColor ? getThemeColor.getThemeColor(stripedColor, theme) : void 0,
      "--table-highlight-on-hover-color": highlightOnHover && highlightOnHoverColor ? getThemeColor.getThemeColor(highlightOnHoverColor, theme) : void 0,
      "--table-sticky-header-offset": stickyHeader ? rem.rem(stickyHeaderOffset) : void 0
    }
  })
);
const Table = factory.factory((_props, ref) => {
  const props = useProps.useProps("Table", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "Table",
    props,
    className,
    style,
    classes: Table_module,
    classNames,
    styles,
    unstyled,
    rootSelector: "table",
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Table_context.TableProvider,
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
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Box.Box,
        {
          component: "table",
          variant,
          ref,
          mod: [{ "data-with-table-border": withTableBorder, "data-tabular-nums": tabularNums }, mod],
          ...getStyles("table"),
          ...others,
          children: children || !!data && /* @__PURE__ */ jsxRuntime.jsx(TableDataRenderer.TableDataRenderer, { data })
        }
      )
    }
  );
});
Table.classes = Table_module;
Table.displayName = "@mantine/core/Table";
Table.Td = Table_components.TableTd;
Table.Th = Table_components.TableTh;
Table.Tr = Table_components.TableTr;
Table.Thead = Table_components.TableThead;
Table.Tbody = Table_components.TableTbody;
Table.Tfoot = Table_components.TableTfoot;
Table.Caption = Table_components.TableCaption;
Table.ScrollContainer = TableScrollContainer.TableScrollContainer;
Table.DataRenderer = TableDataRenderer.TableDataRenderer;

exports.Table = Table;
//# sourceMappingURL=Table.cjs.map
