'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var rem = require('../../core/utils/units-converters/rem.cjs');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var getContrastColor = require('../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
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
var Timeline_context = require('./Timeline.context.cjs');
var TimelineItem = require('./TimelineItem/TimelineItem.cjs');
var Timeline_module = require('./Timeline.module.css.cjs');

const defaultProps = {
  active: -1,
  align: "left",
  reverseActive: false
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { bulletSize, lineWidth, radius, color, autoContrast }) => ({
    root: {
      "--tl-bullet-size": rem.rem(bulletSize),
      "--tl-line-width": rem.rem(lineWidth),
      "--tl-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
      "--tl-color": color ? getThemeColor.getThemeColor(color, theme) : void 0,
      "--tl-icon-color": getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0
    }
  })
);
const Timeline = factory.factory((_props, ref) => {
  const props = useProps.useProps("Timeline", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    active,
    color,
    radius,
    bulletSize,
    align,
    lineWidth,
    reverseActive,
    mod,
    autoContrast,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Timeline",
    classes: Timeline_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const _children = React.Children.toArray(children);
  const items = _children.map(
    (item, index) => React.cloneElement(item, {
      unstyled,
      __align: align,
      __active: item.props?.active || (reverseActive ? active >= _children.length - index - 1 : active >= index),
      __lineActive: item.props?.lineActive || (reverseActive ? active >= _children.length - index - 1 : active - 1 >= index)
    })
  );
  return /* @__PURE__ */ jsxRuntime.jsx(Timeline_context.TimelineProvider, { value: { getStyles }, children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...getStyles("root"), mod: [{ align }, mod], ref, ...others, children: items }) });
});
Timeline.classes = Timeline_module;
Timeline.displayName = "@mantine/core/Timeline";
Timeline.Item = TimelineItem.TimelineItem;

exports.Timeline = Timeline;
//# sourceMappingURL=Timeline.cjs.map
