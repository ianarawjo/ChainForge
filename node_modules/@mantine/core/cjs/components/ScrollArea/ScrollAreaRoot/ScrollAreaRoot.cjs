'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var ScrollArea_context = require('../ScrollArea.context.cjs');

const defaultProps = {
  scrollHideDelay: 1e3,
  type: "hover"
};
const ScrollAreaRoot = React.forwardRef((_props, ref) => {
  const props = useProps.useProps("ScrollAreaRoot", defaultProps, _props);
  const { type, scrollHideDelay, scrollbars, ...others } = props;
  const [scrollArea, setScrollArea] = React.useState(null);
  const [viewport, setViewport] = React.useState(null);
  const [content, setContent] = React.useState(null);
  const [scrollbarX, setScrollbarX] = React.useState(null);
  const [scrollbarY, setScrollbarY] = React.useState(null);
  const [cornerWidth, setCornerWidth] = React.useState(0);
  const [cornerHeight, setCornerHeight] = React.useState(0);
  const [scrollbarXEnabled, setScrollbarXEnabled] = React.useState(false);
  const [scrollbarYEnabled, setScrollbarYEnabled] = React.useState(false);
  const rootRef = hooks.useMergedRef(ref, (node) => setScrollArea(node));
  return /* @__PURE__ */ jsxRuntime.jsx(
    ScrollArea_context.ScrollAreaProvider,
    {
      value: {
        type,
        scrollHideDelay,
        scrollArea,
        viewport,
        onViewportChange: setViewport,
        content,
        onContentChange: setContent,
        scrollbarX,
        onScrollbarXChange: setScrollbarX,
        scrollbarXEnabled,
        onScrollbarXEnabledChange: setScrollbarXEnabled,
        scrollbarY,
        onScrollbarYChange: setScrollbarY,
        scrollbarYEnabled,
        onScrollbarYEnabledChange: setScrollbarYEnabled,
        onCornerWidthChange: setCornerWidth,
        onCornerHeightChange: setCornerHeight
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Box.Box,
        {
          ...others,
          ref: rootRef,
          __vars: {
            "--sa-corner-width": scrollbars !== "xy" ? "0px" : `${cornerWidth}px`,
            "--sa-corner-height": scrollbars !== "xy" ? "0px" : `${cornerHeight}px`
          }
        }
      )
    }
  );
});
ScrollAreaRoot.displayName = "@mantine/core/ScrollAreaRoot";

exports.ScrollAreaRoot = ScrollAreaRoot;
//# sourceMappingURL=ScrollAreaRoot.cjs.map
