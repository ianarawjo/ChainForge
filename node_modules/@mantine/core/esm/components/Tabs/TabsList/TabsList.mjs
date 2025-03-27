'use client';
import { jsx } from 'react/jsx-runtime';
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
import { useTabsContext } from '../Tabs.context.mjs';
import classes from '../Tabs.module.css.mjs';

const defaultProps = {};
const TabsList = factory((_props, ref) => {
  const props = useProps("TabsList", defaultProps, _props);
  const { children, className, grow, justify, classNames, styles, style, mod, ...others } = props;
  const ctx = useTabsContext();
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...others,
      ...ctx.getStyles("list", {
        className,
        style,
        classNames,
        styles,
        props,
        variant: ctx.variant
      }),
      ref,
      role: "tablist",
      variant: ctx.variant,
      mod: [
        {
          grow,
          orientation: ctx.orientation,
          placement: ctx.orientation === "vertical" && ctx.placement,
          inverted: ctx.inverted
        },
        mod
      ],
      "aria-orientation": ctx.orientation,
      __vars: { "--tabs-justify": justify },
      children
    }
  );
});
TabsList.classes = classes;
TabsList.displayName = "@mantine/core/TabsList";

export { TabsList };
//# sourceMappingURL=TabsList.mjs.map
