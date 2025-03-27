'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Mark = require('../Mark/Mark.cjs');
var Text = require('../Text/Text.cjs');
var highlighter = require('./highlighter/highlighter.cjs');

const defaultProps = {};
const Highlight = polymorphicFactory.polymorphicFactory((props, ref) => {
  const { unstyled, children, highlight, highlightStyles, color, ...others } = useProps.useProps(
    "Highlight",
    defaultProps,
    props
  );
  const highlightChunks = highlighter.highlighter(children, highlight);
  return /* @__PURE__ */ jsxRuntime.jsx(Text.Text, { unstyled, ref, ...others, __staticSelector: "Highlight", children: highlightChunks.map(
    ({ chunk, highlighted }, i) => highlighted ? /* @__PURE__ */ jsxRuntime.jsx(
      Mark.Mark,
      {
        unstyled,
        color,
        style: highlightStyles,
        "data-highlight": chunk,
        children: chunk
      },
      i
    ) : /* @__PURE__ */ jsxRuntime.jsx("span", { children: chunk }, i)
  ) });
});
Highlight.classes = Text.Text.classes;
Highlight.displayName = "@mantine/core/Highlight";

exports.Highlight = Highlight;
//# sourceMappingURL=Highlight.cjs.map
