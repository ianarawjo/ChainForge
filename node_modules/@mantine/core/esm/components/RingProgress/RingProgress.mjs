'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { createElement } from 'react';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
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
import { Curve } from './Curve/Curve.mjs';
import { getCurves } from './get-curves/get-curves.mjs';
import classes from './RingProgress.module.css.mjs';

function getClampedThickness(thickness, size) {
  return Math.min(thickness || 12, (size || 120) / 4);
}
const defaultProps = {
  size: 120,
  thickness: 12
};
const varsResolver = createVarsResolver(
  (_, { size, thickness, transitionDuration }) => ({
    root: {
      "--rp-size": rem(size),
      "--rp-label-offset": rem(thickness * 2),
      "--rp-transition-duration": transitionDuration ? `${transitionDuration}ms` : void 0
    }
  })
);
const RingProgress = factory((_props, ref) => {
  const props = useProps("RingProgress", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    label,
    sections,
    size,
    thickness,
    roundCaps,
    rootColor,
    transitionDuration,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "RingProgress",
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
  const clampedThickness = getClampedThickness(thickness, size);
  const curves = getCurves({
    size,
    thickness: clampedThickness,
    sections,
    renderRoundedLineCaps: roundCaps,
    rootColor
  }).map(({ data, sum, root, lineRoundCaps, offset }, index) => /* @__PURE__ */ createElement(
    Curve,
    {
      ...data,
      key: index,
      size,
      thickness: clampedThickness,
      sum,
      offset,
      color: data?.color,
      root,
      lineRoundCaps,
      getStyles
    }
  ));
  return /* @__PURE__ */ jsxs(Box, { ...getStyles("root"), size, ref, ...others, children: [
    /* @__PURE__ */ jsx("svg", { ...getStyles("svg"), children: curves }),
    label && /* @__PURE__ */ jsx("div", { ...getStyles("label"), children: label })
  ] });
});
RingProgress.classes = classes;
RingProgress.displayName = "@mantine/core/RingProgress";

export { RingProgress };
//# sourceMappingURL=RingProgress.mjs.map
