'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import { createScopedKeydownHandler } from '../../../core/utils/create-scoped-keydown-handler/create-scoped-keydown-handler.mjs';
import '@mantine/hooks';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import { useDirection } from '../../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { useTabsContext } from '../Tabs.context.mjs';
import classes from '../Tabs.module.css.mjs';

const defaultProps = {};
const TabsTab = factory((_props, ref) => {
  const props = useProps("TabsTab", defaultProps, _props);
  const {
    className,
    children,
    rightSection,
    leftSection,
    value,
    onClick,
    onKeyDown,
    disabled,
    color,
    style,
    classNames,
    styles,
    vars,
    mod,
    tabIndex,
    ...others
  } = props;
  const theme = useMantineTheme();
  const { dir } = useDirection();
  const ctx = useTabsContext();
  const active = value === ctx.value;
  const activateTab = (event) => {
    ctx.onChange(ctx.allowTabDeactivation ? value === ctx.value ? null : value : value);
    onClick?.(event);
  };
  const stylesApiProps = { classNames, styles, props };
  return /* @__PURE__ */ jsxs(
    UnstyledButton,
    {
      ...others,
      ...ctx.getStyles("tab", { className, style, variant: ctx.variant, ...stylesApiProps }),
      disabled,
      unstyled: ctx.unstyled,
      variant: ctx.variant,
      mod: [
        {
          active,
          disabled,
          orientation: ctx.orientation,
          inverted: ctx.inverted,
          placement: ctx.orientation === "vertical" && ctx.placement
        },
        mod
      ],
      ref,
      role: "tab",
      id: ctx.getTabId(value),
      "aria-selected": active,
      tabIndex: tabIndex !== void 0 ? tabIndex : active || ctx.value === null ? 0 : -1,
      "aria-controls": ctx.getPanelId(value),
      onClick: activateTab,
      __vars: { "--tabs-color": color ? getThemeColor(color, theme) : void 0 },
      onKeyDown: createScopedKeydownHandler({
        siblingSelector: '[role="tab"]',
        parentSelector: '[role="tablist"]',
        activateOnFocus: ctx.activateTabWithKeyboard,
        loop: ctx.loop,
        orientation: ctx.orientation || "horizontal",
        dir,
        onKeyDown
      }),
      children: [
        leftSection && /* @__PURE__ */ jsx("span", { ...ctx.getStyles("tabSection", stylesApiProps), "data-position": "left", children: leftSection }),
        children && /* @__PURE__ */ jsx("span", { ...ctx.getStyles("tabLabel", stylesApiProps), children }),
        rightSection && /* @__PURE__ */ jsx("span", { ...ctx.getStyles("tabSection", stylesApiProps), "data-position": "right", children: rightSection })
      ]
    }
  );
});
TabsTab.classes = classes;
TabsTab.displayName = "@mantine/core/TabsTab";

export { TabsTab };
//# sourceMappingURL=TabsTab.mjs.map
