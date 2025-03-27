'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { useTableContext } from './Table.context.mjs';
import classes from './Table.module.css.mjs';

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
  const Component = factory((_props, ref) => {
    const props = useProps(name, {}, _props);
    const { classNames, className, style, styles, ...others } = props;
    const ctx = useTableContext();
    return /* @__PURE__ */ jsx(
      Box,
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
  Component.classes = classes;
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

export { TableCaption, TableTbody, TableTd, TableTfoot, TableTh, TableThead, TableTr, tableElement };
//# sourceMappingURL=Table.components.mjs.map
