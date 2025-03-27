'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Timeline_context = require('../Timeline.context.cjs');
var Timeline_module = require('../Timeline.module.css.cjs');

const defaultProps = {};
const TimelineItem = factory.factory((_props, ref) => {
  const props = useProps.useProps("TimelineItem", defaultProps, _props);
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
  const ctx = Timeline_context.useTimelineContext();
  const theme = MantineThemeProvider.useMantineTheme();
  const stylesApiProps = { classNames, styles };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ...ctx.getStyles("item", { ...stylesApiProps, className, style }),
      mod: [{ "line-active": __lineActive, active: __active }, mod],
      ref,
      __vars: {
        "--tli-radius": radius ? getSize.getRadius(radius) : void 0,
        "--tli-color": color ? getThemeColor.getThemeColor(color, theme) : void 0,
        "--tli-border-style": lineVariant || void 0
      },
      ...others,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            ...ctx.getStyles("itemBullet", stylesApiProps),
            mod: { "with-child": !!bullet, align: __align, active: __active },
            children: bullet
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { ...ctx.getStyles("itemBody", stylesApiProps), children: [
          title && /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("itemTitle", stylesApiProps), children: title }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("itemContent", stylesApiProps), children })
        ] })
      ]
    }
  );
});
TimelineItem.classes = Timeline_module;
TimelineItem.displayName = "@mantine/core/TimelineItem";

exports.TimelineItem = TimelineItem;
//# sourceMappingURL=TimelineItem.cjs.map
