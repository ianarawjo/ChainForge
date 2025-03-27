'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
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
var useFloatingIndicator = require('./use-floating-indicator.cjs');
var FloatingIndicator_module = require('./FloatingIndicator.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (_theme, { transitionDuration }) => ({
    root: {
      "--transition-duration": typeof transitionDuration === "number" ? `${transitionDuration}ms` : transitionDuration
    }
  })
);
const FloatingIndicator = factory.factory((_props, ref) => {
  const props = useProps.useProps("FloatingIndicator", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    target,
    parent,
    transitionDuration,
    mod,
    displayAfterTransitionEnd,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "FloatingIndicator",
    classes: FloatingIndicator_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const innerRef = React.useRef(null);
  const { initialized, hidden } = useFloatingIndicator.useFloatingIndicator({
    target,
    parent,
    ref: innerRef,
    displayAfterTransitionEnd
  });
  const mergedRef = hooks.useMergedRef(ref, innerRef);
  if (!target || !parent) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref: mergedRef, mod: [{ initialized, hidden }, mod], ...getStyles("root"), ...others });
});
FloatingIndicator.displayName = "@mantine/core/FloatingIndicator";
FloatingIndicator.classes = FloatingIndicator_module;

exports.FloatingIndicator = FloatingIndicator;
//# sourceMappingURL=FloatingIndicator.cjs.map
