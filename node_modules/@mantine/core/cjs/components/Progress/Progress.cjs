'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
var useResolvedStylesApi = require('../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var ProgressLabel = require('./ProgressLabel/ProgressLabel.cjs');
var ProgressRoot = require('./ProgressRoot/ProgressRoot.cjs');
var ProgressSection = require('./ProgressSection/ProgressSection.cjs');
var Progress_module = require('./Progress.module.css.cjs');

const defaultProps = {};
const Progress = factory.factory((_props, ref) => {
  const props = useProps.useProps("Progress", defaultProps, _props);
  const {
    value,
    classNames,
    styles,
    vars,
    color,
    striped,
    animated,
    "aria-label": label,
    ...others
  } = props;
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    ProgressRoot.ProgressRoot,
    {
      ref,
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      vars,
      ...others,
      children: /* @__PURE__ */ jsxRuntime.jsx(
        ProgressSection.ProgressSection,
        {
          value,
          color,
          striped,
          animated,
          "aria-label": label
        }
      )
    }
  );
});
Progress.classes = Progress_module;
Progress.displayName = "@mantine/core/Progress";
Progress.Section = ProgressSection.ProgressSection;
Progress.Root = ProgressRoot.ProgressRoot;
Progress.Label = ProgressLabel.ProgressLabel;

exports.Progress = Progress;
//# sourceMappingURL=Progress.cjs.map
