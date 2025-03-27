'use client';
import { jsx } from 'react/jsx-runtime';
import { Children, cloneElement } from 'react';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { getContrastColor } from '../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.mjs';
import { getAutoContrastValue } from '../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { TimelineProvider } from './Timeline.context.mjs';
import { TimelineItem } from './TimelineItem/TimelineItem.mjs';
import classes from './Timeline.module.css.mjs';

const defaultProps = {
  active: -1,
  align: "left",
  reverseActive: false
};
const varsResolver = createVarsResolver(
  (theme, { bulletSize, lineWidth, radius, color, autoContrast }) => ({
    root: {
      "--tl-bullet-size": rem(bulletSize),
      "--tl-line-width": rem(lineWidth),
      "--tl-radius": radius === void 0 ? void 0 : getRadius(radius),
      "--tl-color": color ? getThemeColor(color, theme) : void 0,
      "--tl-icon-color": getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0
    }
  })
);
const Timeline = factory((_props, ref) => {
  const props = useProps("Timeline", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Timeline",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const _children = Children.toArray(children);
  const items = _children.map(
    (item, index) => cloneElement(item, {
      unstyled,
      __align: align,
      __active: item.props?.active || (reverseActive ? active >= _children.length - index - 1 : active >= index),
      __lineActive: item.props?.lineActive || (reverseActive ? active >= _children.length - index - 1 : active - 1 >= index)
    })
  );
  return /* @__PURE__ */ jsx(TimelineProvider, { value: { getStyles }, children: /* @__PURE__ */ jsx(Box, { ...getStyles("root"), mod: [{ align }, mod], ref, ...others, children: items }) });
});
Timeline.classes = classes;
Timeline.displayName = "@mantine/core/Timeline";
Timeline.Item = TimelineItem;

export { Timeline };
//# sourceMappingURL=Timeline.mjs.map
