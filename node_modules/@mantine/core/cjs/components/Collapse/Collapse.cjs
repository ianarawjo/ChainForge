'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var getStyleObject = require('../../core/Box/get-style-object/get-style-object.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var useCollapse = require('./use-collapse.cjs');

const defaultProps = {
  transitionDuration: 200,
  transitionTimingFunction: "ease",
  animateOpacity: true
};
const Collapse = factory.factory((props, ref) => {
  const {
    children,
    in: opened,
    transitionDuration,
    transitionTimingFunction,
    style,
    onTransitionEnd,
    animateOpacity,
    ...others
  } = useProps.useProps("Collapse", defaultProps, props);
  const theme = MantineThemeProvider.useMantineTheme();
  const shouldReduceMotion = hooks.useReducedMotion();
  const reduceMotion = theme.respectReducedMotion ? shouldReduceMotion : false;
  const duration = reduceMotion ? 0 : transitionDuration;
  const getCollapseProps = useCollapse.useCollapse({
    opened,
    transitionDuration: duration,
    transitionTimingFunction,
    onTransitionEnd
  });
  if (duration === 0) {
    return opened ? /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...others, children }) : null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getCollapseProps({
        style: {
          opacity: opened || !animateOpacity ? 1 : 0,
          transition: animateOpacity ? `opacity ${duration}ms ${transitionTimingFunction}` : "none",
          ...getStyleObject.getStyleObject(style, theme)
        },
        ref,
        ...others
      }),
      children
    }
  );
});
Collapse.displayName = "@mantine/core/Collapse";

exports.Collapse = Collapse;
//# sourceMappingURL=Collapse.cjs.map
