'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import { getRadius } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useTimelineContext } from '../Timeline.context.mjs';
import classes from '../Timeline.module.css.mjs';

const defaultProps = {};
const TimelineItem = factory((_props, ref) => {
  const props = useProps("TimelineItem", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    __active,
    __align,
    __lineActive,
    __vars,
    bullet,
    radius,
    color,
    lineVariant,
    children,
    title,
    mod,
    ...others
  } = props;
  const ctx = useTimelineContext();
  const theme = useMantineTheme();
  const stylesApiProps = { classNames, styles };
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ...ctx.getStyles("item", { ...stylesApiProps, className, style }),
      mod: [{ "line-active": __lineActive, active: __active }, mod],
      ref,
      __vars: {
        "--tli-radius": radius ? getRadius(radius) : void 0,
        "--tli-color": color ? getThemeColor(color, theme) : void 0,
        "--tli-border-style": lineVariant || void 0
      },
      ...others,
      children: [
        /* @__PURE__ */ jsx(
          Box,
          {
            ...ctx.getStyles("itemBullet", stylesApiProps),
            mod: { "with-child": !!bullet, align: __align, active: __active },
            children: bullet
          }
        ),
        /* @__PURE__ */ jsxs("div", { ...ctx.getStyles("itemBody", stylesApiProps), children: [
          title && /* @__PURE__ */ jsx("div", { ...ctx.getStyles("itemTitle", stylesApiProps), children: title }),
          /* @__PURE__ */ jsx("div", { ...ctx.getStyles("itemContent", stylesApiProps), children })
        ] })
      ]
    }
  );
});
TimelineItem.classes = classes;
TimelineItem.displayName = "@mantine/core/TimelineItem";

export { TimelineItem };
//# sourceMappingURL=TimelineItem.mjs.map
