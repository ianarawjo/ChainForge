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
const TabsPanel = factory((_props, ref) => {
  const props = useProps("TabsPanel", defaultProps, _props);
  const { children, className, value, classNames, styles, style, mod, keepMounted, ...others } = props;
  const ctx = useTabsContext();
  const active = ctx.value === value;
  const content = ctx.keepMounted || keepMounted ? children : active ? children : null;
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...others,
      ...ctx.getStyles("panel", {
        className,
        classNames,
        styles,
        style: [style, !active ? { display: "none" } : void 0],
        props
      }),
      ref,
      mod: [{ orientation: ctx.orientation }, mod],
      role: "tabpanel",
      id: ctx.getPanelId(value),
      "aria-labelledby": ctx.getTabId(value),
      children: content
    }
  );
});
TabsPanel.classes = classes;
TabsPanel.displayName = "@mantine/core/TabsPanel";

export { TabsPanel };
//# sourceMappingURL=TabsPanel.mjs.map
