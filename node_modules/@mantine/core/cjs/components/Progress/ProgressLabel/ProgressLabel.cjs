'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Progress_context = require('../Progress.context.cjs');
var Progress_module = require('../Progress.module.css.cjs');

const defaultProps = {};
const ProgressLabel = factory.factory((props, ref) => {
  const { classNames, className, style, styles, vars, ...others } = useProps.useProps(
    "ProgressLabel",
    defaultProps,
    props
  );
  const ctx = Progress_context.useProgressContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      ...ctx.getStyles("label", { className, style, classNames, styles }),
      ...others
    }
  );
});
ProgressLabel.classes = Progress_module;
ProgressLabel.displayName = "@mantine/core/ProgressLabel";

exports.ProgressLabel = ProgressLabel;
//# sourceMappingURL=ProgressLabel.cjs.map
