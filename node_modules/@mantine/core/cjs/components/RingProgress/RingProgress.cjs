'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
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
var Curve = require('./Curve/Curve.cjs');
var getCurves = require('./get-curves/get-curves.cjs');
var RingProgress_module = require('./RingProgress.module.css.cjs');

function getClampedThickness(thickness, size) {
  return Math.min(thickness || 12, (size || 120) / 4);
}
const defaultProps = {
  size: 120,
  thickness: 12
};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { size, thickness, transitionDuration }) => ({
    root: {
      "--rp-size": rem.rem(size),
      "--rp-label-offset": rem.rem(thickness * 2),
      "--rp-transition-duration": transitionDuration ? `${transitionDuration}ms` : void 0
    }
  })
);
const RingProgress = factory.factory((_props, ref) => {
  const props = useProps.useProps("RingProgress", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "RingProgress",
    classes: RingProgress_module,
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
  const curves = getCurves.getCurves({
    size,
    thickness: clampedThickness,
    sections,
    renderRoundedLineCaps: roundCaps,
    rootColor
  }).map(({ data, sum, root, lineRoundCaps, offset }, index) => /* @__PURE__ */ React.createElement(
    Curve.Curve,
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
  return /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ...getStyles("root"), size, ref, ...others, children: [
    /* @__PURE__ */ jsxRuntime.jsx("svg", { ...getStyles("svg"), children: curves }),
    label && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("label"), children: label })
  ] });
});
RingProgress.classes = RingProgress_module;
RingProgress.displayName = "@mantine/core/RingProgress";

exports.RingProgress = RingProgress;
//# sourceMappingURL=RingProgress.cjs.map
