'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Mark } from '../Mark/Mark.mjs';
import { Text } from '../Text/Text.mjs';
import { highlighter } from './highlighter/highlighter.mjs';

const defaultProps = {};
const Highlight = polymorphicFactory((props, ref) => {
  const { unstyled, children, highlight, highlightStyles, color, ...others } = useProps(
    "Highlight",
    defaultProps,
    props
  );
  const highlightChunks = highlighter(children, highlight);
  return /* @__PURE__ */ jsx(Text, { unstyled, ref, ...others, __staticSelector: "Highlight", children: highlightChunks.map(
    ({ chunk, highlighted }, i) => highlighted ? /* @__PURE__ */ jsx(
      Mark,
      {
        unstyled,
        color,
        style: highlightStyles,
        "data-highlight": chunk,
        children: chunk
      },
      i
    ) : /* @__PURE__ */ jsx("span", { children: chunk }, i)
  ) });
});
Highlight.classes = Text.classes;
Highlight.displayName = "@mantine/core/Highlight";

export { Highlight };
//# sourceMappingURL=Highlight.mjs.map
