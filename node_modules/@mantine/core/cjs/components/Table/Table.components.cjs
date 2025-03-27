'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Table_context = require('./Table.context.cjs');
var Table_module = require('./Table.module.css.cjs');

function getDataAttributes(ctx, options) {
  if (!options) {
    return void 0;
  }
  const data = {};
  if (options.columnBorder && ctx.withColumnBorders) {
    data["data-with-column-border"] = true;
  }
  if (options.rowBorder && ctx.withRowBorders) {
    data["data-with-row-border"] = true;
  }
  if (options.striped && ctx.striped) {
    data["data-striped"] = ctx.striped;
  }
  if (options.highlightOnHover && ctx.highlightOnHover) {
    data["data-hover"] = true;
  }
  if (options.captionSide && ctx.captionSide) {
    data["data-side"] = ctx.captionSide;
  }
  if (options.stickyHeader && ctx.stickyHeader) {
    data["data-sticky"] = true;
  }
  return data;
}
function tableElement(element, options) {
  const name = `Table${element.charAt(0).toUpperCase()}${element.slice(1)}`;
  const Component = factory.factory((_props, ref) => {
    const props = useProps.useProps(name, {}, _props);
    const { classNames, className, style, styles, ...others } = props;
    const ctx = Table_context.useTableContext();
    return /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        component: element,
        ref,
        ...getDataAttributes(ctx, options),
        ...ctx.getStyles(element, { className, classNames, style, styles, props }),
        ...others
      }
    );
  });
  Component.displayName = `@mantine/core/${name}`;
  Component.classes = Table_module;
  return Component;
}
const TableTh = tableElement("th", { columnBorder: true });
const TableTd = tableElement("td", { columnBorder: true });
const TableTr = tableElement("tr", {
  rowBorder: true,
  striped: true,
  highlightOnHover: true
});
const TableThead = tableElement("thead", { stickyHeader: true });
const TableTbody = tableElement("tbody");
const TableTfoot = tableElement("tfoot");
const TableCaption = tableElement("caption", { captionSide: true });

exports.TableCaption = TableCaption;
exports.TableTbody = TableTbody;
exports.TableTd = TableTd;
exports.TableTfoot = TableTfoot;
exports.TableTh = TableTh;
exports.TableThead = TableThead;
exports.TableTr = TableTr;
exports.tableElement = tableElement;
//# sourceMappingURL=Table.components.cjs.map
