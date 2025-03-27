'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useListContext } from '../List.context.mjs';
import classes from '../List.module.css.mjs';

const defaultProps = {};
const ListItem = factory((_props, ref) => {
  const props = useProps("ListItem", defaultProps, _props);
  const { classNames, className, style, styles, vars, icon, children, mod, ...others } = props;
  const ctx = useListContext();
  const _icon = icon || ctx.icon;
  const stylesApiProps = { classNames, styles };
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...ctx.getStyles("item", { ...stylesApiProps, className, style }),
      component: "li",
      mod: [{ "with-icon": !!_icon, centered: ctx.center }, mod],
      ref,
      ...others,
      children: /* @__PURE__ */ jsxs("div", { ...ctx.getStyles("itemWrapper", stylesApiProps), children: [
        _icon && /* @__PURE__ */ jsx("span", { ...ctx.getStyles("itemIcon", stylesApiProps), children: _icon }),
        /* @__PURE__ */ jsx("span", { ...ctx.getStyles("itemLabel", stylesApiProps), children })
      ] })
    }
  );
});
ListItem.classes = classes;
ListItem.displayName = "@mantine/core/ListItem";

export { ListItem };
//# sourceMappingURL=ListItem.mjs.map
